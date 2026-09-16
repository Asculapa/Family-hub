-- Accounts and family: invites, member management (spec sections 4.1, 4.2, 9).
-- Invites run as RPCs so every check and write happens in one transaction.

-- FR-1.2: email must be verified before creating or joining a family.
create function email_verified() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = auth.uid()), false);
$$;

create or replace function create_family(name text) returns families
language plpgsql security definer set search_path = public as $$
declare
  fam families;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not email_verified() then
    raise exception 'email not verified' using errcode = '42501';
  end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'already in a family' using errcode = '23505';
  end if;

  insert into families (name, created_by) values (create_family.name, auth.uid()) returning * into fam;
  insert into family_members (family_id, user_id, role) values (fam.id, auth.uid(), 'owner');
  return fam;
end;
$$;

alter table profiles
  add constraint profiles_display_name_length check (length(display_name) <= 60),
  add constraint profiles_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

-- Invites -------------------------------------------------------------------

create table invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  code char(6) not null,
  token text not null unique,
  role role_t not null check (role <> 'owner'),
  max_uses int not null default 1 check (max_uses between 1 and 10),
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid references profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Codes are unique among open invites; expired or used-up invites are closed
-- (revoked_at set) before a new code is generated.
create unique index invites_open_code on invites (code) where revoked_at is null;
create index invites_family on invites (family_id, created_at desc);

create trigger invites_updated_at before update on invites
  for each row execute function set_updated_at();

alter table invites enable row level security;
create policy "owners and adults read" on invites for select
  using (is_member(family_id, '{owner,adult}'));

-- Failed code attempts, for rate limiting (5 per minute per user).
create table invite_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user on invite_attempts (user_id, attempted_at desc);
alter table invite_attempts enable row level security;

create function create_invite(p_family_id uuid, p_role role_t, p_max_uses int default 1)
returns invites language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  if p_role = 'owner' then
    raise exception 'cannot invite an owner' using errcode = '22023';
  end if;
  -- FR-2.3: only an Owner can invite an Adult.
  if not is_member(p_family_id, case when p_role = 'adult' then '{owner}'::role_t[] else '{owner,adult}'::role_t[] end) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update invites set revoked_at = now()
  where revoked_at is null and (expires_at <= now() or uses >= max_uses);

  loop
    begin
      insert into invites (family_id, code, token, role, max_uses, created_by)
      values (
        p_family_id,
        lpad((floor(random() * 1000000))::int::text, 6, '0'),
        encode(extensions.gen_random_bytes(16), 'hex'),
        p_role,
        p_max_uses,
        auth.uid()
      )
      returning * into inv;
      return inv;
    exception when unique_violation then
      -- code collision with another open invite; try again
    end;
  end loop;
end;
$$;

create function revoke_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  select * into inv from invites where id = p_invite_id;
  if inv.id is null or not (is_member(inv.family_id, '{owner}') or
      (inv.created_by = auth.uid() and is_member(inv.family_id, '{adult}'))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update invites set revoked_at = coalesce(revoked_at, now()) where id = p_invite_id;
end;
$$;

-- Joins the caller to a family by 6-digit code or link token. Returns
-- {status, family_id}; status is joined, invalid, rate_limited,
-- already_member, family_full or email_not_verified. Failures return instead
-- of raising so the attempt row used for rate limiting is kept.
create function accept_invite(p_code text default null, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not email_verified() then
    return jsonb_build_object('status', 'email_not_verified');
  end if;
  if (select count(*) from invite_attempts
      where user_id = auth.uid() and attempted_at > now() - interval '1 minute') >= 5 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select * into inv from invites
  where revoked_at is null and expires_at > now() and uses < max_uses
    and ((p_token is not null and token = p_token) or (p_token is null and code = p_code))
  for update;

  if inv.id is null then
    insert into invite_attempts (user_id) values (auth.uid());
    return jsonb_build_object('status', 'invalid');
  end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    return jsonb_build_object('status', 'already_member', 'family_id', inv.family_id);
  end if;
  if (select count(*) from family_members where family_id = inv.family_id) >= 12 then
    return jsonb_build_object('status', 'family_full');
  end if;

  insert into family_members (family_id, user_id, role) values (inv.family_id, auth.uid(), inv.role);
  update invites set uses = uses + 1 where id = inv.id;
  return jsonb_build_object('status', 'joined', 'family_id', inv.family_id);
end;
$$;

-- Members -------------------------------------------------------------------

create function owner_count(fid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from family_members where family_id = fid and role = 'owner';
$$;

-- Owner only. Promoting to owner is how ownership is transferred.
create function set_member_role(p_family_id uuid, p_user_id uuid, p_role role_t) returns void
language plpgsql security definer set search_path = public as $$
declare
  current_role_ role_t;
begin
  if not is_member(p_family_id, '{owner}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select role into current_role_ from family_members
  where family_id = p_family_id and user_id = p_user_id for update;
  if current_role_ is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if current_role_ = 'owner' and p_role <> 'owner' and owner_count(p_family_id) = 1 then
    raise exception 'last owner' using errcode = 'P0001', hint = 'Transfer ownership first';
  end if;
  update family_members set role = p_role where family_id = p_family_id and user_id = p_user_id;
end;
$$;

-- Owner removes anyone; any member may remove themselves (leave).
create function remove_member(p_family_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  target_role role_t;
begin
  if not (is_member(p_family_id, '{owner}') or (p_user_id = auth.uid() and is_member(p_family_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select role into target_role from family_members
  where family_id = p_family_id and user_id = p_user_id for update;
  if target_role is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  -- FR-2.6: the last Owner must transfer ownership or delete the family.
  if target_role = 'owner' and owner_count(p_family_id) = 1 then
    raise exception 'last owner' using errcode = 'P0001', hint = 'Transfer ownership or delete the family';
  end if;
  delete from family_members where family_id = p_family_id and user_id = p_user_id;
end;
$$;

create function delete_family(p_family_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_family_id, '{owner}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from families where id = p_family_id;
end;
$$;

revoke execute on function
  create_invite(uuid, role_t, int), revoke_invite(uuid), accept_invite(text, text),
  set_member_role(uuid, uuid, role_t), remove_member(uuid, uuid), delete_family(uuid)
from anon, public;
grant execute on function
  create_invite(uuid, role_t, int), revoke_invite(uuid), accept_invite(text, text),
  set_member_role(uuid, uuid, role_t), remove_member(uuid, uuid), delete_family(uuid)
to authenticated;

-- New profiles get a random member color; keep in sync with MEMBER_COLORS in packages/ui.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  palette text[] := array['#2563EB', '#DC2626', '#16A34A', '#D97706', '#9333EA', '#0891B2', '#DB2777', '#4B5563'];
begin
  insert into profiles (id, display_name, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''),
    palette[1 + floor(random() * array_length(palette, 1))::int]
  );
  return new;
end;
$$;

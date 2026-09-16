-- Base schema: profiles, families, members and the RLS helper (spec sections 5 and 6).

create extension if not exists pgcrypto;

create type role_t as enum ('owner', 'adult', 'child');

-- updated_at is always set by the server; clients sync on it.
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  color text,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table family_members (
  family_id uuid not null references families (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role role_t not null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id),
  -- One family per user in the MVP; drop for multi-family support in v2.
  unique (user_id)
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger families_updated_at before update on families
  for each row execute function set_updated_at();
create trigger family_members_updated_at before update on family_members
  for each row execute function set_updated_at();

-- Create a profile for every new auth user.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Is the current user in this family, optionally with one of these roles?
create function is_member(fid uuid, roles role_t[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members
    where family_id = fid and user_id = auth.uid()
      and (roles is null or role = any(roles))
  );
$$;

-- Do the current user and this user share a family?
create function shares_family(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members me
    join family_members them on them.family_id = me.family_id
    where me.user_id = auth.uid() and them.user_id = uid
  );
$$;

alter table profiles enable row level security;
create policy "read own and family profiles" on profiles for select
  using (id = auth.uid() or shares_family(id));
create policy "update own profile" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

alter table families enable row level security;
create policy "members read" on families for select using (is_member(id));
create policy "owners update" on families for update using (is_member(id, '{owner}'));
create policy "owners delete" on families for delete using (is_member(id, '{owner}'));

alter table family_members enable row level security;
create policy "members read" on family_members for select using (is_member(family_id));
-- Joining and role changes go through RPCs / Edge Functions, never direct writes.

-- Creates a family and makes the caller its Owner in one transaction.
create function create_family(name text) returns families
language plpgsql security definer set search_path = public as $$
declare
  fam families;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'already in a family' using errcode = '23505';
  end if;

  insert into families (name, created_by) values (create_family.name, auth.uid()) returning * into fam;
  insert into family_members (family_id, user_id, role) values (fam.id, auth.uid(), 'owner');
  return fam;
end;
$$;

revoke execute on function create_family(text) from anon;

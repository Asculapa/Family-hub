-- Activity feed (spec section 4.8), account deletion (FR-1.6) and nightly cleanup.

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  verb text not null check (verb in (
    'item_added', 'item_done', 'event_created', 'event_changed', 'member_joined', 'checked_in'
  )),
  entity_type text not null check (entity_type in ('list_item', 'event', 'member', 'check_in')),
  entity_id uuid,
  -- Snapshot for display, so entries survive later edits: title, list_id, list_name, list_type, note.
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_log_family on activity_log (family_id, created_at desc);

alter table activity_log enable row level security;
create policy "members read" on activity_log for select using (is_member(family_id));

alter publication supabase_realtime add table activity_log;

create function log_activity(fid uuid, verb text, entity_type text, entity_id uuid, summary jsonb)
returns void language sql security definer set search_path = public as $$
  insert into activity_log (family_id, actor_id, verb, entity_type, entity_id, summary)
  values (fid, auth.uid(), verb, entity_type, entity_id, summary);
$$;

create function list_items_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l lists;
begin
  select * into l from lists where id = new.list_id;
  if tg_op = 'INSERT' then
    perform log_activity(new.family_id, 'item_added', 'list_item', new.id,
      jsonb_build_object('title', new.title, 'list_id', l.id, 'list_name', l.name, 'list_type', l.type));
  elsif new.is_done and not old.is_done then
    perform log_activity(new.family_id, 'item_done', 'list_item', new.id,
      jsonb_build_object('title', new.title, 'list_id', l.id, 'list_name', l.name, 'list_type', l.type));
  end if;
  return null;
end;
$$;

create trigger list_items_activity after insert or update of is_done on list_items
  for each row execute function list_items_activity();

create function events_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity(new.family_id, 'event_created', 'event', new.id,
      jsonb_build_object('title', new.title, 'starts_at', new.starts_at));
  elsif new.deleted_at is null and (new.title, new.starts_at, new.ends_at, new.rrule)
        is distinct from (old.title, old.starts_at, old.ends_at, old.rrule) then
    perform log_activity(new.family_id, 'event_changed', 'event', new.id,
      jsonb_build_object('title', new.title, 'starts_at', new.starts_at));
  end if;
  return null;
end;
$$;

create trigger events_activity after insert or update on events
  for each row execute function events_activity();

create function members_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- The founder creating the family is not news.
  if new.role <> 'owner' then
    insert into activity_log (family_id, actor_id, verb, entity_type, entity_id, summary)
    values (new.family_id, new.user_id, 'member_joined', 'member', new.user_id, '{}');
  end if;
  return null;
end;
$$;

create trigger members_activity after insert on family_members
  for each row execute function members_activity();

-- Account deletion (FR-1.6, App Store requirement) --------------------------------
-- Removes the user and everything personal (profile, memberships, preferences via
-- cascades). Shared list items and events stay and show "Former member".
-- If the user is a family's only Owner, the longest-standing member becomes Owner
-- (adults first); if nobody else is left, the family is deleted.
create function delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m family_members;
  heir uuid;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  for m in select * from family_members where user_id = me loop
    if m.role = 'owner' and owner_count(m.family_id) = 1 then
      select user_id into heir from family_members
      where family_id = m.family_id and user_id <> me
      order by (role = 'adult') desc, joined_at
      limit 1;
      if heir is null then
        delete from families where id = m.family_id;
      else
        update family_members set role = 'owner' where family_id = m.family_id and user_id = heir;
      end if;
    end if;
  end loop;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function delete_account() from anon, public;
grant execute on function delete_account() to authenticated;

-- Nightly cleanup at 03:00 UTC (spec section 9) ------------------------------------

create function nightly_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from activity_log where created_at < now() - interval '30 days';
  update invites set revoked_at = now()
    where revoked_at is null and (expires_at <= now() or uses >= max_uses);
  delete from invite_attempts where attempted_at < now() - interval '1 day';
end;
$$;

select cron.schedule('nightly-cleanup', '0 3 * * *', 'select public.nightly_cleanup()');

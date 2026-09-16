-- Push notifications (spec sections 4.7, 7, 9).
-- Triggers and jobs decide who gets what and write notification_queue; the
-- send-push Edge Function drains the queue to Expo Push (APNs/FCM) and, in v2,
-- Web Push. Keeping the decisions in SQL makes them testable with pgTAP.

create type push_provider as enum ('expo', 'webpush');
create type device_platform as enum ('ios', 'android', 'web');

-- One row per device; provider-generic so web push needs no migration (section 8).
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  provider push_provider not null default 'expo',
  token text not null unique,
  web_endpoint text,
  web_keys jsonb,
  platform device_platform not null,
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger push_tokens_updated_at before update on push_tokens
  for each row execute function set_updated_at();

alter table push_tokens enable row level security;
create policy "own tokens read" on push_tokens for select using (user_id = auth.uid());
create policy "own tokens delete" on push_tokens for delete using (user_id = auth.uid());

-- A device's token moves to whoever signs in on it.
create function register_push_token(p_token text, p_platform device_platform, p_device_name text default null)
returns void language sql security definer set search_path = public as $$
  insert into push_tokens (user_id, token, platform, device_name)
  values (auth.uid(), p_token, p_platform, p_device_name)
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform,
        device_name = excluded.device_name, last_seen_at = now();
$$;

-- "Sign out on all devices" stops push everywhere (section 8).
create function forget_devices() returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where user_id = auth.uid();
$$;

create table notification_prefs (
  user_id uuid primary key references profiles (id) on delete cascade,
  item_assigned boolean not null default true,
  event_reminder boolean not null default true,
  location_request boolean not null default true,
  member_joined boolean not null default true,
  list_changed boolean not null default true,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  updated_at timestamptz not null default now()
);

create trigger notification_prefs_updated_at before update on notification_prefs
  for each row execute function set_updated_at();

alter table notification_prefs enable row level security;
create policy "own prefs read" on notification_prefs for select using (user_id = auth.uid());
create policy "own prefs insert" on notification_prefs for insert with check (user_id = auth.uid());
create policy "own prefs update" on notification_prefs for update using (user_id = auth.uid());

create type notification_type as enum (
  'item_assigned', 'event_reminder', 'location_request', 'location_refresh', 'member_joined', 'list_changed'
);

create table notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  family_id uuid references families (id) on delete cascade,
  type notification_type not null,
  title text,
  body text,
  -- Delivered to the app: url (deep link, FR-7.5) and ids for notification actions.
  data jsonb not null default '{}',
  -- iOS/Android category with action buttons (FR-7.4): task, location_request.
  category text,
  -- Data-only push, e.g. asking a device for a fresh position.
  silent boolean not null default false,
  ignore_quiet boolean not null default false,
  dedupe_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  unique (user_id, dedupe_key)
);

create index notification_queue_pending on notification_queue (created_at) where sent_at is null;
-- Only the service role (send-push) touches the queue.
alter table notification_queue enable row level security;

create function notifications_enabled(uid uuid, t notification_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case t
    when 'item_assigned' then coalesce(p.item_assigned, true)
    when 'event_reminder' then coalesce(p.event_reminder, true)
    when 'location_request' then coalesce(p.location_request, true)
    when 'member_joined' then coalesce(p.member_joined, true)
    when 'list_changed' then coalesce(p.list_changed, true)
    else true
  end
  from (select 1) one left join notification_prefs p on p.user_id = uid;
$$;

create function enqueue_notification(
  p_user uuid, p_family uuid, p_type notification_type, p_title text, p_body text,
  p_data jsonb default '{}', p_category text default null, p_silent boolean default false,
  p_ignore_quiet boolean default false, p_dedupe text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not notifications_enabled(p_user, p_type) then
    return;
  end if;
  insert into notification_queue (user_id, family_id, type, title, body, data, category, silent, ignore_quiet, dedupe_key)
  values (p_user, p_family, p_type, p_title, p_body, p_data, p_category, p_silent, p_ignore_quiet, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

revoke execute on function enqueue_notification(uuid, uuid, notification_type, text, text, jsonb, text, boolean, boolean, text)
  from anon, authenticated, public;

create function display_name(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select display_name from profiles where id = uid), ''), 'Someone');
$$;

-- Triggers -------------------------------------------------------------------

create function list_items_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  l lists;
  member uuid;
begin
  select * into l from lists where id = new.list_id;

  -- FR-4.3: the assignee hears about a new assignment (not when assigning yourself).
  if new.assignee_id is not null and new.deleted_at is null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.assignee_id is distinct from actor then
    perform enqueue_notification(
      new.assignee_id, new.family_id, 'item_assigned',
      display_name(actor) || ' assigned you a task', new.title,
      jsonb_build_object('url', '/item/' || new.id, 'itemId', new.id), 'task');
  end if;

  -- FR-7.2: "list changed", batched to at most one per list per 10 minutes.
  if tg_op = 'INSERT' and actor is not null then
    for member in
      select user_id from family_members where family_id = new.family_id and user_id <> actor
    loop
      if not exists (
        select 1 from notification_queue q
        where q.user_id = member and q.type = 'list_changed'
          and q.data ->> 'listId' = new.list_id::text and q.created_at > now() - interval '10 minutes'
      ) then
        perform enqueue_notification(
          member, new.family_id, 'list_changed', l.name,
          display_name(actor) || ' added ' || new.title,
          jsonb_build_object('url', '/lists/' || new.list_id, 'listId', new.list_id));
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create trigger list_items_notify after insert or update of assignee_id on list_items
  for each row execute function list_items_notify();

create function members_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  member uuid;
begin
  if new.role = 'owner' then
    return null;
  end if;
  for member in select user_id from family_members where family_id = new.family_id and user_id <> new.user_id loop
    perform enqueue_notification(
      member, new.family_id, 'member_joined', 'New family member',
      display_name(new.user_id) || ' joined the family', jsonb_build_object('url', '/family'));
  end loop;
  return null;
end;
$$;

create trigger members_notify after insert on family_members
  for each row execute function members_notify();

-- Event reminders (FR-5.5) --------------------------------------------------------
-- Runs every minute; reminders due in the last few minutes are sent once each
-- (dedupe_key), so a late or skipped run doesn't lose them.
create function enqueue_event_reminders(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  recipient uuid;
begin
  for r in
    select e.*, coalesce((x.override ->> 'starts_at')::timestamptz, occ) as occ_start, occ as original_start
    from events e
    cross join lateral event_occurrences(
      e, p_now - interval '5 minutes' + make_interval(mins => e.reminder_minutes),
      p_now + interval '1 minute' + make_interval(mins => e.reminder_minutes)) occ
    left join event_exceptions x
      on x.event_id = e.id and x.original_start = occ and x.deleted_at is null
    where e.reminder_minutes is not null and e.deleted_at is null
      and not coalesce(x.is_cancelled, false)
  loop
    if r.occ_start - make_interval(mins => r.reminder_minutes) > p_now
       or r.occ_start - make_interval(mins => r.reminder_minutes) <= p_now - interval '5 minutes' then
      continue;
    end if;
    -- Participants, or the creator when nobody was picked.
    for recipient in
      select unnest(case when cardinality(r.participant_ids) > 0 then r.participant_ids else array[r.created_by] end)
    loop
      continue when recipient is null;
      perform enqueue_notification(
        recipient, r.family_id, 'event_reminder', r.title,
        case
          when r.all_day then 'All day'
          when r.reminder_minutes >= 1440 then 'Tomorrow at '
          else 'Starts at '
        end || case when r.all_day then '' else to_char(
          r.occ_start at time zone coalesce((select timezone from profiles where id = recipient), 'UTC'), 'HH24:MI') end,
        jsonb_build_object('url', '/event-form?id=' || r.id || '&start=' || to_char(r.original_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'eventId', r.id),
        null, false, false,
        'reminder:' || r.id || ':' || extract(epoch from r.original_start)::bigint);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

-- Sending ---------------------------------------------------------------------------

-- Is it quiet hours for this user right now (FR-7.3)? Handles ranges past midnight.
create function in_quiet_hours(uid uuid, p_now timestamptz default now()) returns boolean
language sql stable security definer set search_path = public as $$
  select case when s < e then t >= s and t < e else t >= s or t < e end
  from (
    select (p_now at time zone coalesce(pr.timezone, 'UTC'))::time as t,
           coalesce(np.quiet_start, '22:00') as s,
           coalesce(np.quiet_end, '07:00') as e
    from profiles pr left join notification_prefs np on np.user_id = pr.id
    where pr.id = uid
  ) x;
$$;

-- Claims pending notifications for delivery, with each recipient's device tokens.
-- Rows are marked sent as they are claimed; the sender records errors afterwards.
create function claim_notifications(p_limit int default 500)
returns table (
  id uuid, type notification_type, title text, body text, data jsonb, category text,
  silent boolean, quiet boolean, tokens text[]
) language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    update notification_queue q set sent_at = now()
    where q.id in (
      select q2.id from notification_queue q2
      where q2.sent_at is null
      order by q2.created_at
      limit p_limit
      for update skip locked
    )
    returning q.*
  )
  select c.id, c.type, c.title, c.body, c.data, c.category, c.silent,
         (not c.ignore_quiet and coalesce(in_quiet_hours(c.user_id), false)) as quiet,
         coalesce(array_agg(t.token) filter (where t.token is not null), '{}')
  from claimed c
  left join push_tokens t on t.user_id = c.user_id and t.provider = 'expo'
  group by c.id, c.type, c.title, c.body, c.data, c.category, c.silent, c.ignore_quiet, c.user_id;
end;
$$;

revoke execute on function claim_notifications(int) from anon, authenticated, public;
grant execute on function claim_notifications(int) to service_role;

create function record_push_errors(p_ids uuid[], p_error text) returns void
language sql security definer set search_path = public as $$
  update notification_queue set error = p_error where id = any(p_ids);
$$;

revoke execute on function record_push_errors(uuid[], text) from anon, authenticated, public;
grant execute on function record_push_errors(uuid[], text) to service_role;

-- Where the database reaches the send-push function. Set per environment:
--   insert into private.settings values ('functions_url', 'https://<ref>.supabase.co/functions/v1'),
--                                       ('service_role_key', '<key>');
create schema if not exists private;
create table private.settings (key text primary key, value text not null);
revoke all on schema private from anon, authenticated, public;

create extension if not exists pg_net;

-- Asks send-push to drain the queue now (pg_net is asynchronous).
create function kick_push_sender() returns void
language plpgsql security definer set search_path = public, private as $$
declare
  url text := (select value from private.settings where key = 'functions_url');
  key text := (select value from private.settings where key = 'service_role_key');
begin
  if url is null or key is null then
    return;
  end if;
  perform net.http_post(
    url := url || '/send-push',
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end;
$$;

-- Deliver right away rather than waiting for the next minute.
create function notification_queue_kick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform kick_push_sender();
  return null;
end;
$$;

create trigger notification_queue_kick after insert on notification_queue
  for each statement execute function notification_queue_kick();

create function minutely_notifications() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform enqueue_event_reminders();
  -- Retries anything a failed kick left behind.
  if exists (select 1 from notification_queue where sent_at is null) then
    perform kick_push_sender();
  end if;
end;
$$;

select cron.schedule('notifications', '* * * * *', 'select public.minutely_notifications()');

-- Old queue rows and tokens of devices not seen for 60 days go in the nightly cleanup.
create or replace function nightly_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from activity_log where created_at < now() - interval '30 days';
  update invites set revoked_at = now()
    where revoked_at is null and (expires_at <= now() or uses >= max_uses);
  delete from invite_attempts where attempted_at < now() - interval '1 day';
  delete from notification_queue where created_at < now() - interval '7 days';
  delete from push_tokens where last_seen_at < now() - interval '60 days';
end;
$$;

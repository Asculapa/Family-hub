-- Live location, check-ins and "Where are you?" (spec sections 4.6, 6, 7).

create type location_mode as enum ('off', 'foreground', 'always');

create table location_settings (
  user_id uuid primary key references profiles (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  mode location_mode not null default 'off',
  paused_until timestamptz,
  -- The adult who allowed a child to share (FR-6.1).
  allowed_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table location_latest (
  user_id uuid primary key references profiles (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real,
  battery_pct smallint check (battery_pct between 0 and 100),
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table location_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  recorded_at timestamptz not null
);

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  -- Null when checking in without a position (no permission).
  lat double precision,
  lng double precision,
  accuracy_m real,
  note text check (length(note) <= 100),
  created_at timestamptz not null default now()
);

create table location_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  from_user uuid not null references profiles (id) on delete cascade,
  to_user uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index location_points_user on location_points (user_id, recorded_at);
create index location_points_age on location_points (recorded_at);
create index check_ins_recent on check_ins (family_id, user_id, created_at desc);
create index location_requests_open on location_requests (to_user) where answered_at is null;

create trigger location_settings_updated_at before update on location_settings
  for each row execute function set_updated_at();
create trigger location_latest_updated_at before update on location_latest
  for each row execute function set_updated_at();

-- Sharing and not paused.
create function sharing_active(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from location_settings
    where user_id = uid and mode <> 'off' and (paused_until is null or paused_until <= now())
  );
$$;

create function location_settings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from family_members where user_id = new.user_id and family_id = new.family_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- An upsert fires this for the proposed row first; keep the existing permission.
  if tg_op = 'INSERT' then
    new.allowed_by := coalesce(new.allowed_by, (select allowed_by from location_settings where user_id = new.user_id));
  end if;
  if new.mode <> 'off' and new.allowed_by is null
     and exists (select 1 from family_members where user_id = new.user_id and role = 'child') then
    raise exception 'needs adult permission' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger location_settings_guard before insert or update on location_settings
  for each row execute function location_settings_guard();

-- Turning sharing off deletes the position and trail (section 6).
create function location_settings_off() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'off' then
    delete from location_latest where user_id = new.user_id;
    delete from location_points where user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger location_settings_off after insert or update of mode on location_settings
  for each row execute function location_settings_off();

-- RLS -----------------------------------------------------------------------------

alter table location_settings enable row level security;
create policy "members read" on location_settings for select using (is_member(family_id));
-- Writes go through set_location_sharing() and allow_child_location().

alter table location_latest enable row level security;
create policy "members read sharing" on location_latest for select
  using (is_member(family_id) and sharing_active(user_id));

alter table location_points enable row level security;
create policy "members read 24h trail" on location_points for select
  using (is_member(family_id) and sharing_active(user_id) and recorded_at > now() - interval '24 hours');

alter table check_ins enable row level security;
create policy "members read" on check_ins for select using (is_member(family_id));

alter table location_requests enable row level security;
create policy "own requests read" on location_requests for select
  using (from_user = auth.uid() or to_user = auth.uid());

alter publication supabase_realtime add table location_latest, location_settings, check_ins;

-- RPCs --------------------------------------------------------------------------------

create function my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from family_members where user_id = auth.uid() limit 1;
$$;

-- An adult allows or stops a child's location sharing (FR-6.1).
create function allow_child_location(p_child uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := (select family_id from family_members where user_id = p_child and role = 'child');
begin
  if fid is null or not is_member(fid, '{owner,adult}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into location_settings (user_id, family_id, mode, allowed_by)
  values (p_child, fid, 'off', case when p_allowed then auth.uid() end)
  on conflict (user_id) do update
    set allowed_by = excluded.allowed_by,
        mode = case when p_allowed then location_settings.mode else 'off' end;
end;
$$;

-- Turns sharing on/off or pauses it (FR-6.1, FR-6.8) for the caller.
create function set_location_sharing(p_mode location_mode, p_paused_until timestamptz default null)
returns location_settings language plpgsql security definer set search_path = public as $$
declare
  fid uuid := my_family();
  row location_settings;
begin
  if fid is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into location_settings (user_id, family_id, mode, paused_until)
  values (auth.uid(), fid, p_mode, p_paused_until)
  on conflict (user_id) do update
    set family_id = excluded.family_id, mode = excluded.mode, paused_until = excluded.paused_until
  returning * into row;
  return row;
end;
$$;

create function answer_location_requests(uid uuid) returns void
language sql security definer set search_path = public as $$
  update location_requests set answered_at = now() where to_user = uid and answered_at is null;
$$;

-- A batch of positions from the phone (FR-6.4): [{lat, lng, accuracy, recorded_at}].
create function ingest_locations(p_points jsonb, p_battery int default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  fid uuid := my_family();
  newest jsonb;
  n int;
begin
  if fid is null or not sharing_active(me) then
    return 0;
  end if;
  if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) > 500 then
    raise exception 'invalid batch' using errcode = '22023';
  end if;

  insert into location_points (user_id, family_id, lat, lng, accuracy_m, recorded_at)
  select me, fid, (p ->> 'lat')::float8, (p ->> 'lng')::float8, (p ->> 'accuracy')::real,
         least((p ->> 'recorded_at')::timestamptz, now())
  from jsonb_array_elements(p_points) p
  where (p ->> 'lat')::float8 between -90 and 90 and (p ->> 'lng')::float8 between -180 and 180
    and (p ->> 'recorded_at')::timestamptz > now() - interval '24 hours';
  get diagnostics n = row_count;

  select p into newest from jsonb_array_elements(p_points) p
  order by (p ->> 'recorded_at')::timestamptz desc limit 1;
  if newest is not null then
    insert into location_latest (user_id, family_id, lat, lng, accuracy_m, battery_pct, recorded_at)
    values (me, fid, (newest ->> 'lat')::float8, (newest ->> 'lng')::float8, (newest ->> 'accuracy')::real,
            p_battery, least((newest ->> 'recorded_at')::timestamptz, now()))
    on conflict (user_id) do update
      set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
          battery_pct = coalesce(excluded.battery_pct, location_latest.battery_pct),
          recorded_at = excluded.recorded_at, family_id = excluded.family_id
      where excluded.recorded_at >= location_latest.recorded_at;
    perform answer_location_requests(me);
  end if;
  return n;
end;
$$;

-- Manual check-in with an optional note (FR-6.6).
create function check_in(p_lat float8 default null, p_lng float8 default null, p_accuracy real default null, p_note text default null)
returns check_ins language plpgsql security definer set search_path = public as $$
declare
  fid uuid := my_family();
  row check_ins;
begin
  if fid is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into check_ins (family_id, user_id, lat, lng, accuracy_m, note)
  values (fid, auth.uid(), p_lat, p_lng, p_accuracy, nullif(trim(p_note), ''))
  returning * into row;
  perform answer_location_requests(auth.uid());
  perform log_activity(fid, 'checked_in', 'check_in', row.id, jsonb_build_object('note', row.note));
  return row;
end;
$$;

-- "Where are you?" (FR-6.7): a silent push refreshes a sharing member's position;
-- otherwise they get a one-tap check-in. Adults asking children ignore quiet hours (FR-7.3).
create function request_location(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := my_family();
  me uuid := auth.uid();
  urgent boolean;
begin
  if fid is null or p_to = me or not exists (select 1 from family_members where user_id = p_to and family_id = fid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- At most one request per pair every 2 minutes.
  if exists (select 1 from location_requests where from_user = me and to_user = p_to
             and created_at > now() - interval '2 minutes') then
    return;
  end if;
  insert into location_requests (family_id, from_user, to_user) values (fid, me, p_to);

  urgent := is_member(fid, '{owner,adult}')
            and exists (select 1 from family_members where user_id = p_to and role = 'child');
  if sharing_active(p_to) then
    perform enqueue_notification(p_to, fid, 'location_refresh', null, null, '{}'::jsonb, null, true, true);
  else
    perform enqueue_notification(
      p_to, fid, 'location_request', display_name(me) || ' asks where you are', 'Tap Check in to let them know',
      jsonb_build_object('url', '/map'), 'location_request', false, urgent);
  end if;
end;
$$;

revoke execute on function set_location_sharing(location_mode, timestamptz), allow_child_location(uuid, boolean), ingest_locations(jsonb, int),
  check_in(float8, float8, real, text), request_location(uuid) from anon, public;
grant execute on function set_location_sharing(location_mode, timestamptz), allow_child_location(uuid, boolean), ingest_locations(jsonb, int),
  check_in(float8, float8, real, text), request_location(uuid) to authenticated;

-- Retention (FR-6.9) ------------------------------------------------------------------

create function hourly_location_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from location_points where recorded_at < now() - interval '24 hours';
$$;

select cron.schedule('location-cleanup', '15 * * * *', 'select public.hourly_location_cleanup()');

create or replace function nightly_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from activity_log where created_at < now() - interval '30 days';
  update invites set revoked_at = now()
    where revoked_at is null and (expires_at <= now() or uses >= max_uses);
  delete from invite_attempts where attempted_at < now() - interval '1 day';
  delete from notification_queue where created_at < now() - interval '7 days';
  delete from push_tokens where last_seen_at < now() - interval '60 days';
  delete from check_ins where created_at < now() - interval '7 days';
  delete from location_requests where created_at < now() - interval '7 days';
end;
$$;

-- Leaving a family stops sharing with it and removes the member from its events.
create function members_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update events set participant_ids = array_remove(participant_ids, old.user_id)
  where family_id = old.family_id and old.user_id = any(participant_ids);
  delete from location_settings where user_id = old.user_id and family_id = old.family_id;
  delete from location_latest where user_id = old.user_id;
  delete from location_points where user_id = old.user_id;
  return null;
end;
$$;

create trigger members_left after delete on family_members
  for each row execute function members_left();

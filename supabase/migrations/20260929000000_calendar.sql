-- Shared calendar (spec section 4.5).
-- Participants are an array on the event (one row per event keeps offline sync simple).
-- Recurrence uses a subset of RRULE the app writes: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY
-- and, for weekly, BYDAY=MO,TU,... Occurrences repeat at the event's wall-clock time in
-- its own time zone, so they stay at 09:00 across daylight-saving changes.

create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'UTC',
  rrule text check (rrule is null or rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*)?$'),
  participant_ids uuid[] not null default '{}',
  location_text text check (length(location_text) <= 200),
  note text check (length(note) <= 2000),
  reminder_minutes int check (reminder_minutes in (10, 60, 1440)),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at >= starts_at)
);

-- "Edit this occurrence" / "delete this occurrence" of a recurring event.
create table event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  original_start timestamptz not null,
  is_cancelled boolean not null default false,
  -- Changed fields for this occurrence: title, starts_at, ends_at, location_text, note.
  override jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (event_id, original_start)
);

create index events_sync on events (family_id, updated_at);
create index events_start on events (family_id, starts_at);
create index event_exceptions_sync on event_exceptions (family_id, updated_at);

create trigger events_updated_at before update on events
  for each row execute function set_updated_at();
create trigger event_exceptions_updated_at before update on event_exceptions
  for each row execute function set_updated_at();

create function events_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    -- Clients can't reassign events; clearing happens when the creator's account is deleted.
    if new.created_by is not null then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
  end if;
  -- Newly added participants must be members of the family. (Existing ones may have
  -- left: their account deletion itself updates the event's created_by.)
  if exists (
    select 1 from unnest(new.participant_ids) p
    where (tg_op = 'INSERT' or p <> all(old.participant_ids))
      and not exists (select 1 from family_members m where m.family_id = new.family_id and m.user_id = p)
  ) then
    raise exception 'participant not in family' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger events_guard before insert or update on events
  for each row execute function events_guard();

create function event_exceptions_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from events where id = new.event_id and family_id = new.family_id) then
    raise exception 'event not in family' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger event_exceptions_guard before insert or update on event_exceptions
  for each row execute function event_exceptions_guard();

-- Section 6: adults edit any event, children only their own.
create function can_edit_event(fid uuid, creator uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_member(fid, '{owner,adult}') or (is_member(fid) and creator = auth.uid());
$$;

alter table events enable row level security;
create policy "members read" on events for select using (is_member(family_id));
create policy "members insert" on events for insert with check (is_member(family_id));
create policy "editors update" on events for update
  using (can_edit_event(family_id, created_by)) with check (is_member(family_id));

alter table event_exceptions enable row level security;
create policy "members read" on event_exceptions for select using (is_member(family_id));
create policy "editors insert" on event_exceptions for insert with check (
  can_edit_event(family_id, (select created_by from events e where e.id = event_id))
);
create policy "editors update" on event_exceptions for update using (
  can_edit_event(family_id, (select created_by from events e where e.id = event_id))
);

alter publication supabase_realtime add table events, event_exceptions;

-- Occurrences ----------------------------------------------------------------

-- Start times of an event's occurrences within [from_ts, to_ts), before exceptions.
-- Candidates are generated per local day in the event's time zone.
create function event_occurrences(e events, from_ts timestamptz, to_ts timestamptz)
returns setof timestamptz
language sql stable set search_path = public as $$
  with base as (
    select (e.starts_at at time zone e.timezone) as local_start,
           substring(e.rrule from 'FREQ=([A-Z]+)') as freq,
           string_to_array(substring(e.rrule from 'BYDAY=([A-Z,]+)'), ',') as byday
  ),
  days as (
    select d::date as day, b.*
    from base b,
         generate_series(
           greatest((from_ts at time zone e.timezone)::date - 1, b.local_start::date),
           (to_ts at time zone e.timezone)::date + 1,
           interval '1 day'
         ) d
    where e.rrule is not null
  )
  select e.starts_at
  where e.rrule is null and e.starts_at >= from_ts and e.starts_at < to_ts
  union all
  select occ from (
    select ((day + local_start::time) at time zone e.timezone) as occ
    from days
    where case freq
      when 'DAILY' then true
      when 'WEEKLY' then
        (array['SU','MO','TU','WE','TH','FR','SA'])[extract(dow from day)::int + 1]
          = any(coalesce(byday, array[(array['SU','MO','TU','WE','TH','FR','SA'])[extract(dow from local_start)::int + 1]]))
      when 'MONTHLY' then extract(day from day) = extract(day from local_start)
      when 'YEARLY' then extract(day from day) = extract(day from local_start)
                     and extract(month from day) = extract(month from local_start)
      else false
    end
  ) o
  where occ >= from_ts and occ < to_ts;
$$;

-- Local development data, loaded by `pnpm db:reset`. Never runs against staging or production.
--
-- Accounts (password 123123123 for all, emails already confirmed):
--   nadtochiy1915@gmail.com   Oleksandr  Owner
--   anna@familyhub.test       Anna       Adult
--   olena@familyhub.test      Olena      Adult (grandma, not sharing location)
--   sofia@familyhub.test      Sofia      Child (location allowed, paused)
--   max@familyhub.test        Max        Child (location allowed)
--
-- Everything is relative to the day you run the reset, so Home, Calendar and Map always
-- show "today". Times are in Europe/Kyiv; positions are around Kyiv.

-- Helpers (session-only) ------------------------------------------------------------

create function pg_temp.add_user(p_id uuid, p_email text, p_name text) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('123123123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', p_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    p_id, p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );
$$;

-- Triggers record auth.uid() as the actor (activity feed, created_by, done_by);
-- this makes the following statements run as that member.
create function pg_temp.act_as(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;

-- A wall-clock time in Kyiv, `days` from today.
create function pg_temp.kyiv(days int, t time) returns timestamptz
language sql stable as $$
  select ((current_date + days) + t) at time zone 'Europe/Kyiv';
$$;

-- Accounts --------------------------------------------------------------------------
-- Profiles are created by the on_auth_user_created trigger.

select pg_temp.add_user('10000000-0000-4000-8000-000000000001', 'nadtochiy1915@gmail.com', 'Oleksandr');
select pg_temp.add_user('10000000-0000-4000-8000-000000000002', 'anna@familyhub.test', 'Anna');
select pg_temp.add_user('10000000-0000-4000-8000-000000000003', 'sofia@familyhub.test', 'Sofia');
select pg_temp.add_user('10000000-0000-4000-8000-000000000004', 'max@familyhub.test', 'Max');
select pg_temp.add_user('10000000-0000-4000-8000-000000000005', 'olena@familyhub.test', 'Olena');

update profiles p set color = v.color, birthday = v.birthday, timezone = 'Europe/Kyiv'
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, '#2563EB', date '1990-03-14'),
  ('10000000-0000-4000-8000-000000000002'::uuid, '#DB2777', date '1991-07-02'),
  -- Birthdays that fall in the next few weeks, so they show on the calendar.
  ('10000000-0000-4000-8000-000000000003'::uuid, '#D97706', (current_date + 5 - interval '12 years')::date),
  ('10000000-0000-4000-8000-000000000004'::uuid, '#16A34A', date '2017-01-20'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '#9333EA', (current_date + 12 - interval '68 years')::date)
) as v(id, color, birthday)
where p.id = v.id;

-- Family ----------------------------------------------------------------------------
-- Creating the family also creates the "Groceries" list and the default categories.

insert into families (id, name, created_by, created_at)
values ('20000000-0000-4000-8000-000000000001', 'The Nadtochiys', '10000000-0000-4000-8000-000000000001', now() - interval '20 days');

insert into family_members (family_id, user_id, role, joined_at) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', now() - interval '20 days'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'adult', now() - interval '19 days'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'child', now() - interval '18 days'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'child', now() - interval '18 days'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'adult', now() - interval '2 days');

-- An open invite to try the join flow: code 482913 (adult, up to 3 people).
insert into invites (family_id, code, token, role, max_uses, created_by)
values ('20000000-0000-4000-8000-000000000001', '482913', 'dev-invite-token-0000000000000001', 'adult', 3,
        '10000000-0000-4000-8000-000000000001');

-- Lists -----------------------------------------------------------------------------

update lists set id = '30000000-0000-4000-8000-000000000001', created_by = '10000000-0000-4000-8000-000000000001'
where family_id = '20000000-0000-4000-8000-000000000001' and name = 'Groceries';

insert into lists (id, family_id, name, type, position, created_by, archived_at) values
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Hardware store', 'shopping', 1, '10000000-0000-4000-8000-000000000001', null),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Home to-dos', 'todo', 2, '10000000-0000-4000-8000-000000000002', null),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'Weekend errands', 'todo', 3, '10000000-0000-4000-8000-000000000001', null),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Birthday party', 'todo', 4, '10000000-0000-4000-8000-000000000002', now() - interval '10 days');

-- Items: (list, title, quantity, unit, category, note, assignee, due, done, added by, added ago).
create temp table seed_items as
select gen_random_uuid() as id, v.*
from (values
  -- Groceries
  ('30000000-0000-4000-8000-000000000001'::uuid, 'Oat milk', 2::numeric, 'cartons', 'Dairy', null, null::uuid, null::timestamptz, false, '10000000-0000-4000-8000-000000000002'::uuid, interval '3 hours'),
  ('30000000-0000-4000-8000-000000000001', 'Bananas', 1, 'bunch', 'Produce', null, null, null, false, '10000000-0000-4000-8000-000000000004', interval '5 hours'),
  ('30000000-0000-4000-8000-000000000001', 'Tomatoes', 1, 'kg', 'Produce', null, null, null, false, '10000000-0000-4000-8000-000000000002', interval '1 day'),
  ('30000000-0000-4000-8000-000000000001', 'Chicken breast', 500, 'g', 'Meat', 'Free-range if they have it', null, null, false, '10000000-0000-4000-8000-000000000002', interval '1 day'),
  ('30000000-0000-4000-8000-000000000001', 'Rye bread', null, null, 'Bakery', null, null, null, false, '10000000-0000-4000-8000-000000000005', interval '40 minutes'),
  ('30000000-0000-4000-8000-000000000001', 'Eggs', 10, 'pcs', 'Dairy', null, null, null, false, '10000000-0000-4000-8000-000000000001', interval '2 days'),
  ('30000000-0000-4000-8000-000000000001', 'Greek yogurt', 4, null, 'Dairy', null, null, null, false, '10000000-0000-4000-8000-000000000003', interval '6 hours'),
  ('30000000-0000-4000-8000-000000000001', 'Kids toothpaste', null, null, 'Pharmacy', 'Strawberry one', null, null, false, '10000000-0000-4000-8000-000000000004', interval '2 days'),
  ('30000000-0000-4000-8000-000000000001', 'Dishwasher tablets', 1, 'pack', 'Household', null, null, null, true, '10000000-0000-4000-8000-000000000001', interval '1 day'),
  ('30000000-0000-4000-8000-000000000001', 'Apples', 1, 'kg', 'Produce', null, null, null, true, '10000000-0000-4000-8000-000000000002', interval '1 day'),
  -- Hardware store
  ('30000000-0000-4000-8000-000000000002', 'AA batteries', 8, 'pcs', null, null, null, null, false, '10000000-0000-4000-8000-000000000004', interval '3 days'),
  ('30000000-0000-4000-8000-000000000002', 'Light bulbs E27', 3, 'pcs', null, 'Warm white', null, null, false, '10000000-0000-4000-8000-000000000001', interval '4 days'),
  ('30000000-0000-4000-8000-000000000002', 'Wood glue', null, null, null, null, null, null, false, '10000000-0000-4000-8000-000000000001', interval '4 days'),
  -- Home to-dos: due today, overdue, upcoming, unassigned and done
  ('30000000-0000-4000-8000-000000000003', 'Take out the bins', null, null, null, null, '10000000-0000-4000-8000-000000000001', pg_temp.kyiv(0, '19:00'), false, '10000000-0000-4000-8000-000000000002', interval '1 day'),
  ('30000000-0000-4000-8000-000000000003', 'Pay electricity bill', null, null, null, 'Account number is in the bills folder', '10000000-0000-4000-8000-000000000001', pg_temp.kyiv(-1, '23:59'), false, '10000000-0000-4000-8000-000000000002', interval '5 days'),
  ('30000000-0000-4000-8000-000000000003', 'Reply to school email', null, null, null, null, '10000000-0000-4000-8000-000000000001', pg_temp.kyiv(0, '23:59'), false, '10000000-0000-4000-8000-000000000001', interval '2 hours'),
  ('30000000-0000-4000-8000-000000000003', 'Pack Max''s swimming bag', null, null, null, 'Goggles are in the car', '10000000-0000-4000-8000-000000000004', pg_temp.kyiv(0, '20:00'), false, '10000000-0000-4000-8000-000000000002', interval '6 hours'),
  ('30000000-0000-4000-8000-000000000003', 'Book dentist for Sofia', null, null, null, null, '10000000-0000-4000-8000-000000000002', pg_temp.kyiv(1, '12:00'), false, '10000000-0000-4000-8000-000000000002', interval '3 days'),
  ('30000000-0000-4000-8000-000000000003', 'Water the plants', null, null, null, null, '10000000-0000-4000-8000-000000000003', pg_temp.kyiv(3, '18:00'), false, '10000000-0000-4000-8000-000000000002', interval '2 days'),
  ('30000000-0000-4000-8000-000000000003', 'Call the plumber', null, null, null, 'Kitchen sink drips', null, null, false, '10000000-0000-4000-8000-000000000005', interval '1 day'),
  ('30000000-0000-4000-8000-000000000003', 'Fix Max''s bike chain', null, null, null, null, '10000000-0000-4000-8000-000000000001', pg_temp.kyiv(-2, '18:00'), true, '10000000-0000-4000-8000-000000000004', interval '4 days'),
  -- Weekend errands
  ('30000000-0000-4000-8000-000000000004', 'Pick up dry cleaning', null, null, null, null, '10000000-0000-4000-8000-000000000001', pg_temp.kyiv(0, '18:00'), false, '10000000-0000-4000-8000-000000000001', interval '1 day'),
  ('30000000-0000-4000-8000-000000000004', 'Return library books', null, null, null, null, '10000000-0000-4000-8000-000000000003', pg_temp.kyiv(2, '12:00'), false, '10000000-0000-4000-8000-000000000002', interval '2 days'),
  ('30000000-0000-4000-8000-000000000004', 'Car wash', null, null, null, null, null, null, false, '10000000-0000-4000-8000-000000000001', interval '3 days'),
  -- Archived list
  ('30000000-0000-4000-8000-000000000005', 'Order the cake', null, null, null, null, '10000000-0000-4000-8000-000000000002', pg_temp.kyiv(-12, '12:00'), true, '10000000-0000-4000-8000-000000000002', interval '14 days')
) as v(list_id, title, quantity, unit, category, note, assignee_id, due_at, is_done, added_by, age);

-- Insert one item at a time as the member who added it, so the activity feed has real actors.
do $$
declare
  i record;
begin
  for i in select * from seed_items order by age desc loop
    perform pg_temp.act_as(i.added_by);
    insert into list_items (id, list_id, family_id, title, quantity, unit, category_id, note, assignee_id, due_at,
                            position, created_at)
    values (
      i.id, i.list_id, '20000000-0000-4000-8000-000000000001', i.title, i.quantity, i.unit,
      (select id from categories where family_id = '20000000-0000-4000-8000-000000000001' and name = i.category),
      i.note, i.assignee_id, i.due_at,
      extract(epoch from now() - i.age) * 1000, now() - i.age
    );
  end loop;

  -- Mark the done ones as done by someone else, a little after they were added.
  for i in select * from seed_items where is_done loop
    perform pg_temp.act_as(case when i.added_by = '10000000-0000-4000-8000-000000000002'
                                then '10000000-0000-4000-8000-000000000001'::uuid
                                else '10000000-0000-4000-8000-000000000002'::uuid end);
    update list_items set is_done = true where id = i.id;
  end loop;
end;
$$;

-- Backdate completions (the guard stamps done_at with now()).
update list_items set done_at = created_at + least(age / 2, interval '20 hours')
from seed_items s where s.id = list_items.id and s.is_done;

-- "Recently bought" suggestions (FR-3.5) beyond what the items above recorded.
insert into item_history (family_id, title_normalized, title, category_id, last_used_at, use_count)
select '20000000-0000-4000-8000-000000000001', lower(v.title), v.title,
       (select id from categories where family_id = '20000000-0000-4000-8000-000000000001' and name = v.category),
       now() - v.ago, v.uses
from (values
  ('Milk', 'Dairy', interval '2 days', 14),
  ('Milk oat', 'Dairy', interval '5 days', 3),
  ('Coffee beans', 'Other', interval '6 days', 6),
  ('Butter', 'Dairy', interval '3 days', 8),
  ('Cheese', 'Dairy', interval '4 days', 7),
  ('Cucumbers', 'Produce', interval '2 days', 9),
  ('Bread', 'Bakery', interval '1 day', 12),
  ('Pasta', 'Other', interval '8 days', 5),
  ('Paper towels', 'Household', interval '9 days', 4),
  ('Bin bags', 'Household', interval '12 days', 3)
) as v(title, category, ago, uses)
on conflict (family_id, title_normalized) do nothing;

-- Calendar --------------------------------------------------------------------------

create temp table seed_events as
select * from (values
  -- Today
  ('40000000-0000-4000-8000-000000000001'::uuid, 'Parent–teacher meeting', pg_temp.kyiv(0, '16:30'), pg_temp.kyiv(0, '17:30'), false,
   null::text, array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002']::uuid[],
   'School No. 57', 'Room 204, bring Sofia''s report', 60, '10000000-0000-4000-8000-000000000002'::uuid, interval '6 days'),
  -- Repeating: Sofia's gymnastics every Tue and Thu since three weeks ago
  ('40000000-0000-4000-8000-000000000002', 'Sofia''s gymnastics', pg_temp.kyiv(-21, '17:00'), pg_temp.kyiv(-21, '18:30'), false,
   'FREQ=WEEKLY;BYDAY=TU,TH', array['10000000-0000-4000-8000-000000000003']::uuid[],
   'Eastside Gym', null, 60, '10000000-0000-4000-8000-000000000002', interval '21 days'),
  -- Repeating: Max's swimming every Saturday
  ('40000000-0000-4000-8000-000000000003', 'Max''s swimming', pg_temp.kyiv(-14, '10:00'), pg_temp.kyiv(-14, '11:00'), false,
   'FREQ=WEEKLY;BYDAY=SA', array['10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001']::uuid[],
   'Olympic pool', 'Bring the swim cap', 60, '10000000-0000-4000-8000-000000000001', interval '14 days'),
  ('40000000-0000-4000-8000-000000000004', 'Max''s dentist appointment', pg_temp.kyiv(3, '15:15'), pg_temp.kyiv(3, '16:00'), false,
   null, array['10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002']::uuid[],
   'Bright Smile Dental', null, 1440, '10000000-0000-4000-8000-000000000002', interval '4 days'),
  ('40000000-0000-4000-8000-000000000005', 'Dinner at Grandma''s', pg_temp.kyiv(6, '14:00'), pg_temp.kyiv(6, '17:00'), false,
   null, array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003',
               '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[],
   'Olena''s place', 'Bring the photo album', 60, '10000000-0000-4000-8000-000000000005', interval '1 day'),
  -- All-day events are stored as UTC dates (first and last day).
  ('40000000-0000-4000-8000-000000000006', 'Anna in Lviv (work trip)', (current_date + 8)::timestamp at time zone 'UTC',
   (current_date + 10)::timestamp at time zone 'UTC', true,
   null, array['10000000-0000-4000-8000-000000000002']::uuid[], 'Lviv', null, null, '10000000-0000-4000-8000-000000000002', interval '5 days'),
  ('40000000-0000-4000-8000-000000000007', 'Pay rent', date_trunc('month', current_date)::timestamp at time zone 'UTC',
   date_trunc('month', current_date)::timestamp at time zone 'UTC', true,
   'FREQ=MONTHLY', array['10000000-0000-4000-8000-000000000001']::uuid[], null, null, 1440, '10000000-0000-4000-8000-000000000001', interval '20 days'),
  ('40000000-0000-4000-8000-000000000008', 'Movie night', pg_temp.kyiv(1, '19:30'), pg_temp.kyiv(1, '21:30'), false,
   null, array['10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001']::uuid[],
   'Living room', 'Kids pick the film', null, '10000000-0000-4000-8000-000000000003', interval '2 days'),
  ('40000000-0000-4000-8000-000000000009', 'Parents'' yoga', pg_temp.kyiv(2, '08:00'), pg_temp.kyiv(2, '09:00'), false,
   'FREQ=WEEKLY;BYDAY=MO,WE,FR', array['10000000-0000-4000-8000-000000000002']::uuid[], 'Studio Prana', null, 10,
   '10000000-0000-4000-8000-000000000002', interval '10 days')
) as v(id, title, starts_at, ends_at, all_day, rrule, participant_ids, location_text, note, reminder_minutes, created_by, age);

do $$
declare
  e record;
begin
  for e in select * from seed_events order by age desc loop
    perform pg_temp.act_as(e.created_by);
    insert into events (id, family_id, title, starts_at, ends_at, all_day, timezone, rrule, participant_ids,
                        location_text, note, reminder_minutes, created_at)
    values (e.id, '20000000-0000-4000-8000-000000000001', e.title, e.starts_at, e.ends_at, e.all_day,
            case when e.all_day then 'UTC' else 'Europe/Kyiv' end, e.rrule, e.participant_ids,
            e.location_text, e.note, e.reminder_minutes, now() - e.age);
  end loop;
end;
$$;

-- Gymnastics is cancelled the next time it falls after today ("delete this event").
insert into event_exceptions (event_id, family_id, original_start, is_cancelled)
select '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', occ, true
from events e, event_occurrences(e, pg_temp.kyiv(1, '00:00'), pg_temp.kyiv(15, '00:00')) occ
where e.id = '40000000-0000-4000-8000-000000000002'
order by occ
limit 1;

-- Location --------------------------------------------------------------------------

insert into location_settings (user_id, family_id, mode, paused_until, allowed_by) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'always', null, null),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'always', null, null),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'foreground', now() + interval '1 hour', '10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'always', null, '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'off', null, null);

-- Latest positions: Oleksandr at the office, Anna at home, Max at school, Sofia (paused) at the gym.
insert into location_latest (user_id, family_id, lat, lng, accuracy_m, battery_pct, recorded_at) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 50.4547, 30.5238, 12, 64, now() - interval '2 minutes'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 50.4422, 30.5367, 8, 81, now() - interval '9 minutes'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 50.4380, 30.5230, 25, 23, now() - interval '50 minutes'),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 50.4470, 30.5140, 15, 47, now() - interval '12 minutes');

-- Today's trail: Anna home → market → home, Max home → school, Oleksandr home → office.
insert into location_points (user_id, family_id, lat, lng, accuracy_m, recorded_at)
select '10000000-0000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000001'::uuid,
       50.4422 + 0.0040 * sin(pi() * s / 12.0), 30.5367 - 0.0060 * sin(pi() * s / 12.0), 10,
       now() - interval '3 hours' + s * interval '10 minutes'
from generate_series(0, 12) s
union all
select '10000000-0000-4000-8000-000000000004'::uuid, '20000000-0000-4000-8000-000000000001'::uuid,
       50.4422 + (50.4470 - 50.4422) * s / 6.0, 30.5367 + (30.5140 - 30.5367) * s / 6.0, 15,
       now() - interval '5 hours' + s * interval '5 minutes'
from generate_series(0, 6) s
union all
select '10000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid,
       50.4422 + (50.4547 - 50.4422) * s / 8.0, 30.5367 + (30.5238 - 30.5367) * s / 8.0, 12,
       now() - interval '7 hours' + s * interval '4 minutes'
from generate_series(0, 8) s;

-- Check-ins go through the RPC so they land in the activity feed.
select pg_temp.act_as('10000000-0000-4000-8000-000000000005');
select check_in(50.4290, 30.5480, 20, 'Home, feeding the cat');
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
select check_in(50.4380, 30.5230, 30, 'At gymnastics');
update check_ins set created_at = now() - case when user_id = '10000000-0000-4000-8000-000000000005'
                                              then interval '2 hours' else interval '55 minutes' end;

-- Tidy up ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', false);

-- Line the activity feed up with the backdated rows.
update activity_log a set created_at = i.created_at
from list_items i where a.verb = 'item_added' and a.entity_id = i.id;
update activity_log a set created_at = i.done_at
from list_items i where a.verb = 'item_done' and a.entity_id = i.id;
update activity_log a set created_at = e.created_at
from events e where a.verb = 'event_created' and a.entity_id = e.id;
update activity_log a set created_at = c.created_at
from check_ins c where a.verb = 'checked_in' and a.entity_id = c.id;
update activity_log a set created_at = m.joined_at
from family_members m where a.verb = 'member_joined' and a.entity_id = m.user_id;

-- Seeding queued "assigned to you" and "list changed" pushes; don't send them.
delete from notification_queue;

drop table seed_items, seed_events;

-- Edge Functions ----------------------------------------------------------------------
-- Lets the local database call Edge Functions (send-push) through the API gateway.
-- The key is the public local-development service role key, not a secret.
insert into private.settings (key, value) values
  ('functions_url', 'http://supabase_kong_family-hub:8000/functions/v1'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU');

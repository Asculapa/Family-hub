begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c0', 'cal-owner@example.com', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'cal-child@example.com', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'cal-outsider@example.com', now());

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c0');
create temp table fam as select (create_family('Calendars')).id as id;
grant select on fam to authenticated;
create temp table inv as select * from create_invite((select id from fam), 'child');
grant select on inv to authenticated;

insert into events (id, family_id, title, starts_at, ends_at)
values ('22222222-2222-4222-8222-000000000001', (select id from fam), 'Parents evening',
        '2026-10-01 17:00+00', '2026-10-01 18:00+00');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select accept_invite(p_code := (select code::text from inv));

-- Children create their own events and edit only those (section 6).
select lives_ok($$
  insert into events (id, family_id, title, starts_at, ends_at, participant_ids)
  values ('22222222-2222-4222-8222-000000000002', (select id from fam), 'Football',
          '2026-10-02 15:00+00', '2026-10-02 16:00+00', '{00000000-0000-0000-0000-0000000000c1}')
$$, 'a child can create an event');
select is((select created_by::text from events where title = 'Football'), '00000000-0000-0000-0000-0000000000c1',
  'created_by is set by the server');
select lives_ok($$ update events set title = 'Football practice' where title = 'Football' $$,
  'a child can edit their own event');
update events set title = 'Hacked' where title = 'Parents evening';
select is((select title from events where id = '22222222-2222-4222-8222-000000000001'), 'Parents evening',
  'a child cannot edit someone else''s event');

select throws_ok($$
  insert into events (family_id, title, starts_at, ends_at, participant_ids)
  values ((select id from fam), 'Party', now(), now(), '{00000000-0000-0000-0000-0000000000c2}')
$$, '23503', 'participant not in family', 'participants must be family members');
select throws_ok($$
  insert into events (family_id, title, starts_at, ends_at, rrule)
  values ((select id from fam), 'Bad', now(), now(), 'FREQ=HOURLY')
$$, '23514', null, 'only supported recurrence rules are accepted');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from events), 0, 'outsiders see no events');

-- Occurrences (checked as the owner of the data).
reset role;
insert into events (id, family_id, title, starts_at, ends_at, timezone, rrule) values
  ('22222222-2222-4222-8222-000000000003', (select id from fam), 'Swim', '2026-10-05 06:00+00',
   '2026-10-05 07:00+00', 'Europe/Kyiv', 'FREQ=WEEKLY;BYDAY=MO,TH'),
  ('22222222-2222-4222-8222-000000000004', (select id from fam), 'Rent', '2026-01-31 08:00+00',
   '2026-01-31 09:00+00', 'UTC', 'FREQ=MONTHLY');

select results_eq(
  $$ select o from events e, event_occurrences(e, '2026-10-19', '2026-10-31') o
     where e.id = '22222222-2222-4222-8222-000000000003' order by o $$,
  $$ values ('2026-10-19 06:00+00'::timestamptz), ('2026-10-22 06:00+00'),
            ('2026-10-26 07:00+00'), ('2026-10-29 07:00+00') $$,
  'weekly occurrences keep 09:00 Kyiv time across the DST change');
select is(
  (select count(*)::int from events e, event_occurrences(e, '2026-10-01', '2026-10-05') o where e.id = '22222222-2222-4222-8222-000000000003'),
  0, 'no occurrences before the first one');
select results_eq(
  $$ select o from events e, event_occurrences(e, '2026-02-01', '2026-06-01') o
     where e.id = '22222222-2222-4222-8222-000000000004' order by o $$,
  $$ values ('2026-03-31 08:00+00'::timestamptz), ('2026-05-31 08:00+00') $$,
  'monthly occurrences skip months without that day');
select is(
  (select count(*)::int from events e, event_occurrences(e, '2026-10-01', '2026-10-02') o
   where e.id = '22222222-2222-4222-8222-000000000001'),
  1, 'a one-off event has one occurrence in range');

-- Exceptions must belong to the event's family.
select throws_ok($$
  insert into event_exceptions (event_id, family_id, original_start, is_cancelled)
  values ('22222222-2222-4222-8222-000000000003', (select id from families where name = 'Nope'), now(), true)
$$, '23503', 'event not in family', 'an exception needs the event''s family');

select * from finish();
rollback;

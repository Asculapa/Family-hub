begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f0', 'l-owner@example.com', now(), '{"full_name": "Olena"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'l-child@example.com', now(), '{"full_name": "Kira"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'l-outsider@example.com', now(), '{"full_name": "Eve"}');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;
create function pg_temp.point(lat float8, lng float8, ago interval) returns jsonb language sql as $$
  select jsonb_build_object('lat', lat, 'lng', lng, 'accuracy', 20, 'recorded_at', now() - ago);
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
create temp table fam as select (create_family('Locators')).id as id;
grant select on fam to authenticated;
create temp table inv as select (create_invite((select id from fam), 'child')).code::text as code;
grant select on inv to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select accept_invite(p_code := (select code from inv));

-- Off by default; positions are ignored until sharing is on (FR-6.1).
select is(ingest_locations(jsonb_build_array(pg_temp.point(50.45, 30.52, '1 minute'))), 0,
  'positions are ignored while sharing is off');

-- Children need an adult's permission.
select throws_ok($$ select set_location_sharing('always') $$, '42501', 'needs adult permission',
  'a child cannot turn sharing on alone');
select throws_ok($$ select allow_child_location('00000000-0000-0000-0000-0000000000f1', true) $$, '42501', 'not allowed',
  'a child cannot allow themselves');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select lives_ok($$ select allow_child_location('00000000-0000-0000-0000-0000000000f1', true) $$, 'an adult allows the child');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ select set_location_sharing('always') $$, 'the child can now share');

-- Batches (FR-6.4).
select is(ingest_locations(jsonb_build_array(
  pg_temp.point(50.40, 30.50, '10 minutes'), pg_temp.point(50.45, 30.52, '1 minute'),
  pg_temp.point(99, 30, '2 minutes'), pg_temp.point(50.3, 30.3, '2 days')), 80), 2,
  'valid points from the last 24 hours are stored');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select results_eq($$ select lat, battery_pct::int from location_latest where family_id = (select id from fam) $$, $$ values (50.45::float8, 80) $$,
  'the family sees the newest position and battery (FR-6.5)');
select is((select count(*)::int from location_points where family_id = (select id from fam)), 2, 'the family sees today''s trail');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select is((select count(*)::int from location_latest), 0, 'outsiders see nothing');

-- An older batch arriving late doesn't move the marker back.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select ingest_locations(jsonb_build_array(pg_temp.point(50.10, 30.10, '30 minutes')));
reset role;
select is((select lat from location_latest where family_id = (select id from fam)), 50.45::float8, 'a late older batch keeps the newer position');

-- Pause (FR-6.8): family sees "paused", not the position.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select set_location_sharing('always', now() + interval '1 hour');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select is((select count(*)::int from location_latest), 0, 'a paused member''s position is hidden');
select isnt((select paused_until from location_settings where user_id = '00000000-0000-0000-0000-0000000000f1'), null,
  'the family can see that sharing is paused');

-- "Where are you?" (FR-6.7).
select request_location('00000000-0000-0000-0000-0000000000f1');
reset role;
select results_eq($$ select type::text, ignore_quiet from notification_queue where type::text like 'location%' and family_id = (select id from fam) $$,
  $$ values ('location_request', true) $$,
  'a paused child gets a visible request that ignores quiet hours when an adult asks');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select set_location_sharing('always');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select request_location('00000000-0000-0000-0000-0000000000f1');
reset role;
select is((select count(*)::int from location_requests where family_id = (select id from fam)), 1, 'repeat requests within 2 minutes are ignored');
delete from location_requests where family_id = (select id from fam);
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select request_location('00000000-0000-0000-0000-0000000000f1');
reset role;
select is((select silent from notification_queue where type = 'location_refresh' and family_id = (select id from fam)), true,
  'a sharing member gets a silent refresh push');

-- Check-in answers the request and shows in activity (FR-6.6).
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ select check_in(50.45, 30.52, 15, 'At school') $$, 'a member checks in');
reset role;
select is((select count(*)::int from location_requests where answered_at is null and family_id = (select id from fam)), 0, 'check-in answers requests');
select is((select summary ->> 'note' from activity_log where verb = 'checked_in' and family_id = (select id from fam)), 'At school', 'check-ins show in activity');

-- Turning off deletes the position and trail (section 6).
set local role authenticated;
select set_location_sharing('off');
reset role;
select is((select count(*)::int from location_latest where family_id = (select id from fam)) + (select count(*)::int from location_points where family_id = (select id from fam)), 0,
  'turning sharing off deletes position and trail');

-- Cleanup (FR-6.9).
insert into location_points (user_id, family_id, lat, lng, recorded_at)
values ('00000000-0000-0000-0000-0000000000f0', (select id from fam), 1, 1, now() - interval '25 hours');
select hourly_location_cleanup();
select is((select count(*)::int from location_points where family_id = (select id from fam)), 0, 'trail points older than 24 hours are deleted');

select * from finish();
rollback;

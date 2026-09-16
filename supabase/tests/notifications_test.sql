begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e0', 'n-owner@example.com', now(), '{"full_name": "Olena"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'n-child@example.com', now(), '{"full_name": "Kira"}');
update profiles set timezone = 'Europe/Kyiv' where id = '00000000-0000-0000-0000-0000000000e1';

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;
create function pg_temp.queue(uid text) returns table (type text, title text, body text) language sql as $$
  select type::text, title, body from notification_queue where user_id = uid::uuid order by created_at, type;
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
create temp table fam as select (create_family('Notifiers')).id as id;
grant select on fam to authenticated;
create temp table inv as select (create_invite((select id from fam), 'child')).code::text as code;
grant select on inv to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select accept_invite(p_code := (select code from inv));
select lives_ok($$ select register_push_token('ExponentPushToken[kira-phone]', 'ios', 'Kira''s iPhone') $$,
  'a device registers its push token');

reset role;
select results_eq($$ select type, body from pg_temp.queue('00000000-0000-0000-0000-0000000000e0') $$,
  $$ values ('member_joined', 'Kira joined the family') $$, 'members hear about a new member');

-- Assignment and list changes (FR-4.3, FR-7.2).
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
insert into list_items (list_id, family_id, title, assignee_id)
select id, family_id, 'Tidy room', '00000000-0000-0000-0000-0000000000e1' from lists where family_id = (select id from fam);
insert into list_items (list_id, family_id, title)
select id, family_id, 'Milk' from lists where family_id = (select id from fam);
insert into list_items (list_id, family_id, title, assignee_id)
select id, family_id, 'Mine', '00000000-0000-0000-0000-0000000000e0' from lists where family_id = (select id from fam);

reset role;
select results_eq(
  $$ select type, title, body from pg_temp.queue('00000000-0000-0000-0000-0000000000e1') order by type $$,
  $$ values ('item_assigned', 'Olena assigned you a task', 'Tidy room'),
            ('list_changed', 'Groceries', 'Olena added Tidy room') $$,
  'the assignee is notified, and list changes are batched to one per 10 minutes');
select is((select count(*)::int from notification_queue where user_id = '00000000-0000-0000-0000-0000000000e0'
           and type = 'item_assigned'), 0, 'assigning yourself sends nothing');
select is((select data ->> 'url' from notification_queue where type = 'item_assigned' and family_id = (select id from fam)),
  '/item/' || (select id from list_items where title = 'Tidy room' and family_id = (select id from fam)), 'notifications deep-link to the item');
select is((select category from notification_queue where type = 'item_assigned' and family_id = (select id from fam)), 'task',
  'assignments offer the Mark done action');

-- Preferences (FR-7.3).
insert into notification_prefs (user_id, item_assigned) values ('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
update list_items set assignee_id = '00000000-0000-0000-0000-0000000000e1' where title = 'Milk' and family_id = (select id from fam);
reset role;
select is((select count(*)::int from notification_queue where type = 'item_assigned' and family_id = (select id from fam)), 1,
  'a turned-off type is not sent');

-- Event reminders (FR-5.5) in the recipient's time zone.
insert into events (id, family_id, title, starts_at, ends_at, timezone, rrule, reminder_minutes, participant_ids, created_by)
values
  ('33333333-3333-4333-8333-000000000001', (select id from fam), 'Swim', '2026-10-05 06:00+00', '2026-10-05 07:00+00',
   'Europe/Kyiv', 'FREQ=WEEKLY;BYDAY=MO', 60, '{00000000-0000-0000-0000-0000000000e1}', '00000000-0000-0000-0000-0000000000e0'),
  ('33333333-3333-4333-8333-000000000002', (select id from fam), 'Dentist', '2026-10-12 12:00+00', '2026-10-12 13:00+00',
   'UTC', null, 10, '{}', '00000000-0000-0000-0000-0000000000e0');
insert into event_exceptions (event_id, family_id, original_start, is_cancelled)
values ('33333333-3333-4333-8333-000000000001', (select id from fam), '2026-10-19 06:00+00', true);

create function pg_temp.reminders_at(t timestamptz) returns int language plpgsql as $$
begin
  perform enqueue_event_reminders(t);
  return (select count(*)::int from notification_queue
          where type = 'event_reminder' and family_id = (select id from fam));
end;
$$;

select is(pg_temp.reminders_at('2026-10-12 04:50+00'), 0, 'no reminder before it is due');
select is(pg_temp.reminders_at('2026-10-12 05:00:30+00'), 1, 'the reminder is queued when due');
select is(pg_temp.reminders_at('2026-10-12 05:02+00'), 1, 'a later run does not queue it again');
select results_eq(
  $$ select title, body from notification_queue where type = 'event_reminder' and family_id = (select id from fam) $$,
  $$ values ('Swim', 'Starts at 09:00') $$, 'the time is shown in the recipient''s time zone');
select is(pg_temp.reminders_at('2026-10-19 05:00:30+00'), 1, 'a cancelled occurrence has no reminder');
select is(pg_temp.reminders_at('2026-10-26 06:00:30+00'), 2, 'the series continues after DST ends');
select is(pg_temp.reminders_at('2026-10-12 11:50:30+00'), 3, 'events without participants remind the creator');
select is((select user_id::text from notification_queue where title = 'Dentist' and family_id = (select id from fam)), '00000000-0000-0000-0000-0000000000e0',
  'the creator gets it');

-- Quiet hours (FR-7.3): Kira is in Kyiv, quiet 22:00-07:00.
select ok(in_quiet_hours('00000000-0000-0000-0000-0000000000e1', '2026-10-12 20:00+00'), '23:00 in Kyiv is quiet');
select ok(not in_quiet_hours('00000000-0000-0000-0000-0000000000e1', '2026-10-12 09:00+00'), '12:00 in Kyiv is not');

-- Claiming for delivery.
set local role service_role;
select results_eq(
  $$ select type::text, tokens from claim_notifications() where type = 'item_assigned' $$,
  $$ values ('item_assigned', array['ExponentPushToken[kira-phone]']) $$,
  'claimed notifications carry the recipient''s device tokens');

select * from finish();
rollback;

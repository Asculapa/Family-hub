begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000d0', 'act-owner@example.com', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'act-adult@example.com', now()),
  ('00000000-0000-0000-0000-0000000000d2', 'act-child@example.com', now()),
  ('00000000-0000-0000-0000-0000000000d3', 'act-solo@example.com', now());

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
create temp table fam as select (create_family('Actives')).id as id;
grant select on fam to authenticated;
create temp table inv as
  select (create_invite((select id from fam), 'child')).code::text as child_code,
         (create_invite((select id from fam), 'adult')).code::text as adult_code;
grant select on inv to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select accept_invite(p_code := (select child_code from inv));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select accept_invite(p_code := (select adult_code from inv));

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
insert into list_items (list_id, family_id, title)
select id, family_id, 'Crayons' from lists where family_id = (select id from fam);
update list_items set is_done = true where title = 'Crayons';
insert into events (family_id, title, starts_at, ends_at)
values ((select id from fam), 'Recital', '2026-11-01 16:00+00', '2026-11-01 17:00+00');
update events set title = 'Piano recital' where title = 'Recital';

select results_eq(
  $$ select verb, summary ->> 'title' from activity_log
     where verb <> 'member_joined' order by verb $$,
  $$ values ('event_changed', 'Piano recital'), ('event_created', 'Recital'),
            ('item_added', 'Crayons'), ('item_done', 'Crayons') $$,
  'item and event changes are logged with a title snapshot');
select is((select summary ->> 'list_name' from activity_log where verb = 'item_added'), 'Groceries',
  'item entries include the list name');
select is((select actor_id::text from activity_log where verb = 'item_done'), '00000000-0000-0000-0000-0000000000d2',
  'the actor is recorded');
select is((select count(*)::int from activity_log where verb = 'member_joined'), 2,
  'joining members are logged, the founder is not');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select is((select count(*)::int from activity_log), 0, 'outsiders see no activity');
create temp table solo as select (create_family('Solo')).id as id;
grant select on solo to authenticated;

-- The owner created an item and takes part in an event; neither may block deleting the account.
reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d0"}', true);
insert into list_items (list_id, family_id, title)
select id, family_id, 'Owner item' from lists where family_id = (select id from fam);
insert into events (family_id, title, starts_at, ends_at, participant_ids, created_by)
values ((select id from fam), 'Parents evening', now(), now(),
        '{00000000-0000-0000-0000-0000000000d0,00000000-0000-0000-0000-0000000000d1}', '00000000-0000-0000-0000-0000000000d0');
set local role authenticated;

-- Deleting the only owner hands the family to the adult, not the earlier-joined child.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select lives_ok($$ select delete_account() $$, 'a user can delete their account');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000d0'), 0,
  'the auth user is gone');
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000d0'), 0,
  'the profile is gone');
select is((select role::text from family_members where user_id = '00000000-0000-0000-0000-0000000000d1'), 'owner',
  'the adult becomes owner');
select is((select role::text from family_members where user_id = '00000000-0000-0000-0000-0000000000d2'), 'child',
  'the child keeps their role');
select is((select count(*)::int from lists where family_id = (select id from fam)), 1,
  'shared data stays with the family');
select is((select participant_ids::text from events where title = 'Parents evening' and family_id = (select id from fam)),
  '{00000000-0000-0000-0000-0000000000d1}', 'the deleted user leaves their events');
select is((select created_by from list_items where title = 'Owner item' and family_id = (select id from fam)), null,
  'their items stay, as "Former member"');

-- The last member deleting their account deletes the family.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select delete_account();
reset role;
select is((select count(*)::int from families where id = (select id from solo)), 0,
  'a family with no one left is deleted');

select lives_ok($$ select nightly_cleanup() $$, 'nightly cleanup runs');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- o = owner, a = adult, c = child, u = unverified, x = outsider
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a1', 'adult@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'child@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'unverified@example.com', null),
  ('00000000-0000-0000-0000-0000000000a4', 'outsider@example.com', now());

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

set local role authenticated;

-- Unverified users cannot create a family (FR-1.2).
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select create_family('Nope') $$, '42501', 'email not verified',
  'an unverified user cannot create a family');

-- Owner creates the family and invites an adult.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
create temp table ids as select (create_family('Smiths')).id as family_id;
grant select on ids to authenticated;

create temp table adult_invite as
  select * from create_invite((select family_id from ids), 'adult', 1);
grant select on adult_invite to authenticated;
select matches((select code::text from adult_invite), '^\d{6}$', 'invite code is 6 digits');
select is(length((select token from adult_invite)), 32, 'invite token is 128 bits as hex');
select is((select count(*)::int from invites), 1, 'owner sees the family invites');

-- Adult joins with the code.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is(accept_invite(p_code := (select code::text from adult_invite)) ->> 'status', 'joined',
  'a verified user joins with a valid code');
select is((select role::text from family_members where user_id = auth.uid()), 'adult',
  'the invite sets the role');
select is((select i.uses from adult_invite a join invites i using (id)), 1, 'the invite use is counted');

-- A single-use invite cannot be used twice.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select is(accept_invite(p_code := (select code::text from adult_invite)) ->> 'status', 'invalid',
  'a used-up invite is rejected');

-- Adults can invite children but not adults (FR-2.3).
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select create_invite((select family_id from ids), 'adult') $$, '42501', 'not allowed',
  'an adult cannot invite an adult');
create temp table child_invite as
  select * from create_invite((select family_id from ids), 'child', 2);
grant select on child_invite to authenticated;
select is((select role::text from child_invite), 'child', 'an adult can invite a child');

-- Child joins by link token.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select is(accept_invite(p_token := (select token from child_invite)) ->> 'status', 'joined',
  'a user joins with a link token');
select is((select count(*)::int from invites), 0, 'children cannot read invites');
select throws_ok($$ select create_invite((select family_id from ids), 'child') $$, '42501', 'not allowed',
  'a child cannot invite');
select is(accept_invite(p_token := (select token from child_invite)) ->> 'status', 'already_member',
  'a member cannot join a second family');

-- Unverified user cannot join.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select is(accept_invite(p_token := (select token from child_invite)) ->> 'status', 'email_not_verified',
  'an unverified user cannot join');

-- Rate limiting: 5 wrong codes per minute.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select accept_invite(p_code := '000000') from generate_series(1, 4);
select is(accept_invite(p_code := (select code::text from child_invite)) ->> 'status', 'rate_limited',
  'a user is rate-limited after 5 wrong codes');

-- Revoking.
select throws_ok($$ select revoke_invite((select id from child_invite)) $$, '42501', 'not allowed',
  'an outsider cannot revoke an invite');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
select lives_ok($$ select revoke_invite((select id from child_invite)) $$, 'the owner can revoke an invite');

-- Roles and removal (FR-2.5, FR-2.6).
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select set_member_role((select family_id from ids), '00000000-0000-0000-0000-0000000000a2', 'adult') $$,
  '42501', 'not allowed', 'an adult cannot change roles');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
select throws_ok(
  $$ select remove_member((select family_id from ids), '00000000-0000-0000-0000-0000000000a0') $$,
  'P0001', 'last owner', 'the last owner cannot leave');
select throws_ok(
  $$ select set_member_role((select family_id from ids), '00000000-0000-0000-0000-0000000000a0', 'adult') $$,
  'P0001', 'last owner', 'the last owner cannot demote themselves');
select lives_ok(
  $$ select set_member_role((select family_id from ids), '00000000-0000-0000-0000-0000000000a1', 'owner') $$,
  'the owner can promote an adult to owner');
select lives_ok(
  $$ select remove_member((select family_id from ids), '00000000-0000-0000-0000-0000000000a0') $$,
  'an owner can leave once another owner exists');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ select remove_member((select family_id from ids), '00000000-0000-0000-0000-0000000000a2') $$,
  'a child can leave the family');

select * from finish();
rollback;

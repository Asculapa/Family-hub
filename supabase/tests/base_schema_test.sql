begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Two users: Alice creates a family, Bob is an outsider.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', now());

select is((select count(*)::int from profiles where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 2,
  'a profile is created for each new user');
select is((select count(*)::int from profiles where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') and color ~ '^#[0-9A-F]{6}$'), 2,
  'new profiles get a member color');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';

select lives_ok($$ select create_family('Smiths') $$, 'a user can create a family');
select is((select role::text from family_members), 'owner', 'the creator becomes Owner');
select throws_ok($$ select create_family('Again') $$, '23505', 'already in a family',
  'a user cannot create a second family in the MVP');
select is((select count(*)::int from families), 1, 'a member can read their family');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b"}';

select is((select count(*)::int from families), 0, 'a non-member cannot read the family');
select is((select count(*)::int from profiles), 1, 'a non-member sees only their own profile');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- o = owner, c = child, x = outsider
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000b0', 'lists-owner@example.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'lists-child@example.com', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'lists-outsider@example.com', now());

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b0');
create temp table fam as select (create_family('Listers')).id as id;
grant select on fam to authenticated;

select is((select name from lists where family_id = (select id from fam)), 'Groceries',
  'a new family gets a Groceries list');
select is((select count(*)::int from categories where family_id = (select id from fam)), 7,
  'a new family gets the default categories');

create temp table child_invite as select * from create_invite((select id from fam), 'child');
grant select on child_invite to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select accept_invite(p_code := (select code::text from child_invite));

create temp table ids as select
  (select id from lists where family_id = (select id from fam)) as list_id,
  '11111111-1111-4111-8111-000000000001'::uuid as item_id;
grant select on ids to authenticated;

-- Child adds and completes an item (section 6: add, edit, complete).
select lives_ok($$
  insert into list_items (id, list_id, family_id, title)
  values ((select item_id from ids), (select list_id from ids), (select id from fam), 'Milk')
$$, 'a child can add an item with a client-generated id');
select is((select created_by::text from list_items), '00000000-0000-0000-0000-0000000000b1',
  'created_by is set by the server');
select lives_ok($$ update list_items set is_done = true where id = (select item_id from ids) $$,
  'a child can mark an item done');
select is((select done_by::text from list_items), '00000000-0000-0000-0000-0000000000b1',
  'done_by is set by the server');
select isnt((select done_at from list_items), null, 'done_at is set by the server');
select is((select title || ':' || use_count from item_history), 'Milk:1',
  'buying an item records it for suggestions');
select is((select title from suggest_items((select id from fam), 'mi')), 'Milk',
  'suggestions match by prefix, case-insensitively');

select lives_ok($$ update list_items set is_done = false where id = (select item_id from ids) $$,
  'an item can be unmarked');
select is((select done_at from list_items), null, 'unmarking clears done_at');

-- Children cannot delete items or manage lists.
select throws_ok($$ update list_items set deleted_at = now() where id = (select item_id from ids) $$,
  '42501', 'not allowed', 'a child cannot delete an item');
select throws_ok($$ insert into lists (family_id, name) values ((select id from fam), 'Kid list') $$,
  '42501', null, 'a child cannot create a list');

-- Items must belong to a list of the same family.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
create temp table other_fam as select (create_family('Others')).id as id;
grant select on other_fam to authenticated;
select throws_ok($$
  insert into list_items (list_id, family_id, title)
  values ((select list_id from ids), (select id from other_fam), 'Sneaky')
$$, '23503', 'list not in family', 'an item cannot point at another family''s list');
select is((select count(*)::int from list_items), 0, 'an outsider sees no items of other families');
select is((select count(*)::int from suggest_items((select id from fam), 'mi')), 0,
  'an outsider gets no suggestions from other families');

-- Owner deletes (soft) and manages lists.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b0');
select lives_ok($$ update list_items set deleted_at = now() where id = (select item_id from ids) $$,
  'an owner can delete an item');
select lives_ok($$ insert into lists (family_id, name, type) values ((select id from fam), 'Chores', 'todo') $$,
  'an owner can create a list');

-- Bought items are cleared after 24 hours (FR-3.3).
reset role;
insert into list_items (list_id, family_id, title, is_done)
values ((select list_id from ids), (select id from fam), 'Old bread', true);
update list_items set done_at = now() - interval '25 hours' where title = 'Old bread';
select clear_bought_items();
select isnt((select deleted_at from list_items where title = 'Old bread'), null,
  'bought items older than 24 hours are cleared');

select * from finish();
rollback;

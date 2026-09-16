-- Shopping and to-do lists (spec sections 4.3, 4.4, 5).
-- Rows are never hard-deleted by clients: deleted_at syncs deletions to offline devices.

create type list_type as enum ('shopping', 'todo');

create table lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  type list_type not null default 'shopping',
  position double precision not null default 0,
  created_by uuid references profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  -- Duplicated from lists for RLS and realtime filters.
  family_id uuid not null references families (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  quantity numeric check (quantity > 0),
  unit text check (length(unit) <= 20),
  category_id uuid references categories (id) on delete set null,
  note text check (length(note) <= 1000),
  assignee_id uuid references profiles (id) on delete set null,
  due_at timestamptz,
  is_done boolean not null default false,
  done_by uuid references profiles (id) on delete set null,
  done_at timestamptz,
  position double precision not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Powers "recently bought" suggestions (FR-3.5).
create table item_history (
  family_id uuid not null references families (id) on delete cascade,
  title_normalized text not null,
  title text not null,
  category_id uuid references categories (id) on delete set null,
  last_used_at timestamptz not null default now(),
  use_count int not null default 1,
  primary key (family_id, title_normalized)
);

create index lists_sync on lists (family_id, updated_at);
create index categories_sync on categories (family_id, updated_at);
create index list_items_sync on list_items (family_id, updated_at);
create index list_items_list on list_items (list_id, is_done, position);

create trigger lists_updated_at before update on lists
  for each row execute function set_updated_at();
create trigger categories_updated_at before update on categories
  for each row execute function set_updated_at();
create trigger list_items_updated_at before update on list_items
  for each row execute function set_updated_at();

-- Server-owned fields and rules the RLS policies cannot express.
create function list_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lists where id = new.list_id and family_id = new.family_id) then
    raise exception 'list not in family' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if new.deleted_at is not null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  else
    -- Clients can't reassign items; clearing happens when the creator's account is deleted.
    if new.created_by is not null then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
    -- Children may complete items but not delete them (section 6).
    if old.deleted_at is null and new.deleted_at is not null and auth.uid() is not null
       and not is_member(new.family_id, '{owner,adult}') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;

  if new.is_done and (tg_op = 'INSERT' or not old.is_done) then
    new.done_by := coalesce(auth.uid(), new.done_by);
    new.done_at := now();
  elsif not new.is_done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger list_items_guard before insert or update on list_items
  for each row execute function list_items_guard();

-- Bought items feed suggestions.
create function record_item_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_done and (tg_op = 'INSERT' or not old.is_done)
     and (select type from lists where id = new.list_id) = 'shopping' then
    insert into item_history (family_id, title_normalized, title, category_id)
    values (new.family_id, lower(trim(new.title)), trim(new.title), new.category_id)
    on conflict (family_id, title_normalized) do update
      set title = excluded.title,
          category_id = coalesce(excluded.category_id, item_history.category_id),
          last_used_at = now(),
          use_count = item_history.use_count + 1;
  end if;
  return null;
end;
$$;

create trigger list_items_history after insert or update of is_done on list_items
  for each row execute function record_item_history();

-- Every family starts with a "Groceries" list and default categories (FR-3.1, FR-3.4).
create function seed_family_lists(fid uuid) returns void
language sql security definer set search_path = public as $$
  insert into lists (family_id, name, type, position) values (fid, 'Groceries', 'shopping', 0);
  insert into categories (family_id, name, position)
  select fid, name, ord from unnest(array[
    'Produce', 'Dairy', 'Meat', 'Bakery', 'Household', 'Pharmacy', 'Other'
  ]) with ordinality as c(name, ord);
$$;

create function on_family_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform seed_family_lists(new.id);
  return null;
end;
$$;

create trigger families_seed_lists after insert on families
  for each row execute function on_family_created();

select seed_family_lists(id) from families f
where not exists (select 1 from lists l where l.family_id = f.id);

-- RLS -------------------------------------------------------------------------

alter table lists enable row level security;
create policy "members read" on lists for select using (is_member(family_id));
create policy "adults insert" on lists for insert with check (is_member(family_id, '{owner,adult}'));
create policy "adults update" on lists for update
  using (is_member(family_id, '{owner,adult}')) with check (is_member(family_id, '{owner,adult}'));

alter table categories enable row level security;
create policy "members read" on categories for select using (is_member(family_id));
create policy "adults insert" on categories for insert with check (is_member(family_id, '{owner,adult}'));
create policy "adults update" on categories for update
  using (is_member(family_id, '{owner,adult}')) with check (is_member(family_id, '{owner,adult}'));

alter table list_items enable row level security;
create policy "members read" on list_items for select using (is_member(family_id));
create policy "members insert" on list_items for insert with check (is_member(family_id));
create policy "members update" on list_items for update
  using (is_member(family_id)) with check (is_member(family_id));

alter table item_history enable row level security;
create policy "members read" on item_history for select using (is_member(family_id));

-- Top 8 past items matching what the user typed (FR-3.5).
create function suggest_items(p_family_id uuid, p_prefix text)
returns table (title text, category_id uuid)
language sql stable set search_path = public as $$
  select h.title, h.category_id from item_history h
  where h.family_id = p_family_id
    and h.title_normalized like lower(trim(p_prefix)) || '%'
  order by h.use_count desc, h.last_used_at desc
  limit 8;
$$;

-- Realtime (FR-3.7) ---------------------------------------------------------

alter publication supabase_realtime add table lists, categories, list_items;

-- Cleanup (FR-3.3): bought items disappear 24 hours after being bought. --------

create extension if not exists pg_cron;

create function clear_bought_items() returns void
language sql security definer set search_path = public as $$
  update list_items set deleted_at = now()
  where is_done and deleted_at is null and done_at < now() - interval '24 hours';
$$;

select cron.schedule('clear-bought-items', '5 * * * *', 'select public.clear_bought_items()');

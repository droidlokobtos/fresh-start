-- Raizes Genealogia: modelo relacional para arvore familiar
create extension if not exists pgcrypto;

create table if not exists public.family_trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Minha família',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  full_name text not null,
  birth_name text,
  nickname text,
  gender text check (gender in ('female','male','other','unknown')),
  life_status text not null default 'unknown' check (life_status in ('living','deceased','unknown')),
  birth_date date,
  birth_place text,
  death_date date,
  death_place text,
  occupation text,
  biography text,
  notes text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','family_report','documented','confirmed')),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (death_date is null or birth_date is null or death_date >= birth_date),
  check (life_status <> 'living' or death_date is null)
);

create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  person_a_id uuid not null references public.people(id) on delete cascade,
  person_b_id uuid references public.people(id) on delete set null,
  relationship_type text not null default 'partnership'
    check (relationship_type in ('marriage','stable_union','dating','partnership','co_parenting','other')),
  relationship_status text not null default 'unknown'
    check (relationship_status in ('current','ended','ended_by_death','unknown')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  check (person_b_id is null or person_a_id <> person_b_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- Parent-child links are independent of partnerships: supports unknown parent,
-- adoption/step-parent relations, and children from different relationships.
create table if not exists public.parent_child_relationships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  parent_id uuid not null references public.people(id) on delete cascade,
  child_id uuid not null references public.people(id) on delete cascade,
  parent_role text not null default 'parent'
    check (parent_role in ('biological','adoptive','step','guardian','parent')),
  notes text,
  created_at timestamptz not null default now(),
  check (parent_id <> child_id),
  unique (tree_id, parent_id, child_id, parent_role)
);

-- Explicitly associates a child with a partnership when that context is known.
create table if not exists public.partnership_children (
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  child_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partnership_id, child_id)
);

create table if not exists public.person_sources (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  source_type text not null default 'family_account',
  title text,
  description text,
  source_date date,
  file_path text,
  created_at timestamptz not null default now()
);

create index if not exists people_tree_name_idx on public.people(tree_id, full_name);
create index if not exists partnerships_tree_idx on public.partnerships(tree_id);
create index if not exists parent_child_parent_idx on public.parent_child_relationships(parent_id);
create index if not exists parent_child_child_idx on public.parent_child_relationships(child_id);

-- Ownership is enforced through the tree owner. Policies intentionally prevent
-- public access; users only access records belonging to their own tree.
alter table public.family_trees enable row level security;
alter table public.people enable row level security;
alter table public.partnerships enable row level security;
alter table public.parent_child_relationships enable row level security;
alter table public.partnership_children enable row level security;
alter table public.person_sources enable row level security;

create policy "owners manage own trees" on public.family_trees
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owners manage people" on public.people
for all using (exists (select 1 from public.family_trees t where t.id = tree_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.family_trees t where t.id = tree_id and t.owner_id = auth.uid()));

create policy "owners manage partnerships" on public.partnerships
for all using (exists (select 1 from public.family_trees t where t.id = tree_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.family_trees t where t.id = tree_id and t.owner_id = auth.uid()));

create policy "owners manage parent child links" on public.parent_child_relationships
for all using (exists (select 1 from public.family_trees t where t.id = tree_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.family_trees t where t.id = tree_id and t.owner_id = auth.uid()));

create policy "owners manage partnership children" on public.partnership_children
for all using (exists (
  select 1 from public.partnerships p join public.family_trees t on t.id = p.tree_id
  where p.id = partnership_id and t.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.partnerships p join public.family_trees t on t.id = p.tree_id
  where p.id = partnership_id and t.owner_id = auth.uid()
));

create policy "owners manage person sources" on public.person_sources
for all using (exists (
  select 1 from public.people p join public.family_trees t on t.id = p.tree_id
  where p.id = person_id and t.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.people p join public.family_trees t on t.id = p.tree_id
  where p.id = person_id and t.owner_id = auth.uid()
));

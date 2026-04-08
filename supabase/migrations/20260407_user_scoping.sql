-- Creatorflow: add users table + user scoping

create extension if not exists "pgcrypto";

-- 1) users table linked to Supabase Auth
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_unique on public.users (email) where email is not null;

-- 2) Add user_id to domain tables
alter table if exists public.contacts
  add column if not exists user_id uuid references public.users(id) on delete cascade;

alter table if exists public.deals
  add column if not exists user_id uuid references public.users(id) on delete cascade;

alter table if exists public.tasks
  add column if not exists user_id uuid references public.users(id) on delete cascade;

-- Ensure activities table exists (older DBs may not have it yet)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  action_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.activities
  add column if not exists user_id uuid references public.users(id) on delete cascade;

-- Helpful indexes
create index if not exists contacts_user_id_idx on public.contacts(user_id);
create index if not exists deals_user_id_idx on public.deals(user_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists activities_user_id_idx on public.activities(user_id);

-- Optional: enforce uniqueness of contact names per user (uncomment if desired)
-- create unique index if not exists contacts_user_name_unique on public.contacts(user_id, lower(name));

-- 3) Enable RLS
alter table public.users enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;

-- 4) Policies (minimal)
-- users: can read/insert/update own profile row
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select
  using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert
  with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- contacts/deals/tasks: full access to own rows
drop policy if exists "contacts_own" on public.contacts;
create policy "contacts_own" on public.contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "deals_own" on public.deals;
create policy "deals_own" on public.deals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tasks_own" on public.tasks;
create policy "tasks_own" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "activities_own" on public.activities;
create policy "activities_own" on public.activities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


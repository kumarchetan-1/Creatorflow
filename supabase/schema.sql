create extension if not exists "pgcrypto";

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'brand',
  email text,
  instagram_handle text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null default 0,
  status text not null check (status in ('lead', 'pitched', 'negotiating', 'won', 'lost', 'closed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'open', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_user_id on contacts(user_id);
create index if not exists idx_deals_user_id on deals(user_id);
create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_contact_id on tasks(contact_id);
create index if not exists idx_activities_user_id_created_at on activities(user_id, created_at desc);

alter table contacts enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;
alter table activities enable row level security;

create policy "contacts_select_own"
on contacts for select
using (auth.uid() = user_id);

create policy "contacts_insert_own"
on contacts for insert
with check (auth.uid() = user_id);

create policy "deals_select_own"
on deals for select
using (auth.uid() = user_id);

create policy "deals_insert_own"
on deals for insert
with check (auth.uid() = user_id);

create policy "tasks_select_own"
on tasks for select
using (auth.uid() = user_id);

create policy "tasks_insert_own"
on tasks for insert
with check (auth.uid() = user_id);

create policy "activities_select_own"
on activities for select
using (auth.uid() = user_id);

create policy "activities_insert_own"
on activities for insert
with check (auth.uid() = user_id);

alter table contacts add column if not exists type text not null default 'brand';

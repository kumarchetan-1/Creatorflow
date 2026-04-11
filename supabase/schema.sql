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
  status text not null check (
    status in (
      'lead',
      'pitched',
      'negotiating',
      'contract_sent',
      'contract_signed',
      'invoice_sent',
      'paid',
      'won',
      'lost',
      'closed'
    )
  ),
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

-- Unified multi-channel inbox feed
create table if not exists inbound_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('email', 'instagram', 'upwork', 'form')),
  external_id text,
  thread_id text,
  from_name text,
  from_email text,
  from_handle text,
  subject text,
  body text,
  snippet text,
  received_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'triaged', 'converted', 'ignored')),
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_user_id on contacts(user_id);
create index if not exists idx_deals_user_id on deals(user_id);
create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_contact_id on tasks(contact_id);
create index if not exists idx_activities_user_id_created_at on activities(user_id, created_at desc);
create index if not exists idx_inbound_items_user_id on inbound_items(user_id);
create index if not exists idx_inbound_items_user_received_at on inbound_items(user_id, received_at desc);
create index if not exists idx_inbound_items_user_status on inbound_items(user_id, status);
create unique index if not exists inbound_items_user_source_external_unique
  on inbound_items(user_id, source, external_id);

alter table contacts enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;
alter table activities enable row level security;
alter table inbound_items enable row level security;

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

create policy "inbound_items_select_own"
on inbound_items for select
using (auth.uid() = user_id);

create policy "inbound_items_insert_own"
on inbound_items for insert
with check (auth.uid() = user_id);

create policy "inbound_items_update_own"
on inbound_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table contacts add column if not exists type text not null default 'brand';

-- Gmail OAuth (server-only via service role; no client policies)
create table if not exists google_oauth_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

create index if not exists google_oauth_tokens_updated_at_idx on google_oauth_tokens (updated_at desc);

alter table google_oauth_tokens enable row level security;

-- Chat history
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_threads_user_updated on chat_threads(user_id, updated_at desc);
create index if not exists idx_chat_messages_thread_created on chat_messages(thread_id, created_at asc);
create index if not exists idx_chat_messages_user on chat_messages(user_id);

alter table chat_threads enable row level security;
alter table chat_messages enable row level security;

create policy "chat_threads_select_own"
on chat_threads for select
using (auth.uid() = user_id);

create policy "chat_threads_insert_own"
on chat_threads for insert
with check (auth.uid() = user_id);

create policy "chat_threads_update_own"
on chat_threads for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chat_messages_select_own"
on chat_messages for select
using (auth.uid() = user_id);

create policy "chat_messages_insert_own"
on chat_messages for insert
with check (auth.uid() = user_id);

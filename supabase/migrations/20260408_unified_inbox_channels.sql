-- Creatorflow: unified multi-channel inbox + conversions

create extension if not exists "pgcrypto";

-- Inbound items unify Email / Instagram DM / Upwork / Forms into a single lifecycle feed.
create table if not exists public.inbound_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 'email' | 'instagram' | 'upwork' | 'form'
  source text not null check (source in ('email', 'instagram', 'upwork', 'form')),

  -- For idempotency and threading (e.g. Gmail message id, IG thread id)
  external_id text,
  thread_id text,

  -- Sender identity (one or more may be present depending on channel)
  from_name text,
  from_email text,
  from_handle text,

  subject text,
  body text,
  snippet text,

  received_at timestamptz not null default now(),

  -- 'new' -> 'triaged' -> 'converted' or 'ignored'
  status text not null default 'new' check (status in ('new', 'triaged', 'converted', 'ignored')),

  -- Optional linkage once converted into CRM objects
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists inbound_items_user_id_idx on public.inbound_items(user_id);
create index if not exists inbound_items_user_status_idx on public.inbound_items(user_id, status);
create index if not exists inbound_items_user_received_idx on public.inbound_items(user_id, received_at desc);
create index if not exists inbound_items_user_source_idx on public.inbound_items(user_id, source);
-- Full unique index required for INSERT ... ON CONFLICT (user_id, source, external_id) / Supabase upsert.
create unique index if not exists inbound_items_user_source_external_unique
  on public.inbound_items(user_id, source, external_id);

alter table public.inbound_items enable row level security;

drop policy if exists "inbound_items_select_own" on public.inbound_items;
create policy "inbound_items_select_own" on public.inbound_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "inbound_items_insert_own" on public.inbound_items;
create policy "inbound_items_insert_own" on public.inbound_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "inbound_items_update_own" on public.inbound_items;
create policy "inbound_items_update_own" on public.inbound_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


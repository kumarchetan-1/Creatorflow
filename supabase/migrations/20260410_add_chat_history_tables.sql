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

drop policy if exists "chat_threads_select_own" on chat_threads;
drop policy if exists "chat_threads_insert_own" on chat_threads;
drop policy if exists "chat_threads_update_own" on chat_threads;
drop policy if exists "chat_messages_select_own" on chat_messages;
drop policy if exists "chat_messages_insert_own" on chat_messages;

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

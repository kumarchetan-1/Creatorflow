-- Per-user Gmail refresh tokens (read/write only from server via service role).
create table if not exists google_oauth_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

create index if not exists google_oauth_tokens_updated_at_idx on google_oauth_tokens (updated_at desc);

alter table google_oauth_tokens enable row level security;

-- No policies: anon/authenticated JWTs cannot access this table.
-- Next.js uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.

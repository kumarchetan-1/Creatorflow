-- Supabase/Postgres upsert uses ON CONFLICT (user_id, source, external_id).
-- A PARTIAL unique index (WHERE external_id IS NOT NULL) does NOT satisfy that
-- conflict target — you get: "no unique or exclusion constraint matching the ON CONFLICT specification".
-- Replace with a full unique index on (user_id, source, external_id).
-- (PostgreSQL treats NULLs as distinct in UNIQUE, so multiple rows with NULL external_id are still allowed.)

drop index if exists public.inbound_items_user_source_external_unique;

create unique index if not exists inbound_items_user_source_external_unique
  on public.inbound_items (user_id, source, external_id);

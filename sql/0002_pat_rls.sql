-- Daemoon — PAT table + audit grant fix.
-- Idempotent: safe to run multiple times.

-- 1. PAT table (was created out-of-band in dev; codify here)
create table if not exists public.daemoon_pats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text,
  token_hash   text not null unique,
  prefix       text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists daemoon_pats_user on public.daemoon_pats (user_id);

alter table public.daemoon_pats enable row level security;
revoke all on public.daemoon_pats from anon, authenticated;

-- 2. Owner-only view (no token_hash exposed)
create or replace view public.daemoon_my_pats as
  select id, label, prefix, created_at, last_used_at
  from public.daemoon_pats
  where user_id = auth.uid();
grant select on public.daemoon_my_pats to authenticated;

-- 3. Audit log: same pattern — own-rows view + grant
create or replace view public.daemoon_my_audit as
  select id, provider, tool, ok, created_at
  from public.daemoon_audit
  where user_id = auth.uid();
grant select on public.daemoon_my_audit to authenticated;

select 'daemoon_pats + daemoon_my_pats + daemoon_my_audit installed' as status;

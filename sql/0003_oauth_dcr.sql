-- OAuth 2.0 Dynamic Client Registration + code grant tables.
-- Codifies tables that until now were created out-of-band on the Supabase project.
-- Safe to re-run: all statements use IF NOT EXISTS / DO blocks.

create extension if not exists "pgcrypto";

-- Registered OAuth clients (one row per Smithery / Claude.ai / etc.).
create table if not exists public.daemoon_oauth_clients (
  client_id uuid primary key default gen_random_uuid(),
  redirect_uris text[] not null,
  client_name text,
  created_at timestamptz not null default now()
);

-- One-time authorization codes.  pat_id is the dmn_ prefix only (string),
-- never the full secret.  pat_raw is the full secret that the token endpoint
-- returns once and then clears.
create table if not exists public.daemoon_oauth_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pat_id text not null,
  pat_raw text not null,
  client_id uuid references public.daemoon_oauth_clients(client_id) on delete set null,
  redirect_uri text not null,
  code_challenge text,
  code_challenge_method text,
  exchanged boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists daemoon_oauth_codes_expires_at_idx
  on public.daemoon_oauth_codes (expires_at);

-- RLS: only the service role touches these tables.  No anon / authed access.
alter table public.daemoon_oauth_clients enable row level security;
alter table public.daemoon_oauth_codes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daemoon_oauth_clients'
      and policyname = 'service_only'
  ) then
    create policy service_only on public.daemoon_oauth_clients
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daemoon_oauth_codes'
      and policyname = 'service_only'
  ) then
    create policy service_only on public.daemoon_oauth_codes
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

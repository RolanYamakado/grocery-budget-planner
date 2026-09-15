-- Run this once in your Supabase project's SQL Editor (Project → SQL Editor → New query).
-- Single-row-per-user JSONB blob, mirroring this app's existing localStorage shape 1:1 —
-- deliberately not normalized into per-plan rows, so the app's aggregation/pricing logic
-- needs zero changes.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  plan_history jsonb not null default '[]'::jsonb,
  swipe_history jsonb not null default '[]'::jsonb,
  affinity_scores jsonb not null default '{}'::jsonb,
  affinity_decay_week text,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "select own" on public.user_data
  for select using (auth.uid() = user_id);

create policy "insert own" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "update own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: account deletion (a service-role/admin action) cascades via the
-- foreign key at the Postgres level, not through client-facing RLS-checked DML.

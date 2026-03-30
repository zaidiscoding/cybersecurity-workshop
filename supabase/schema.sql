create extension if not exists "pgcrypto";

create table if not exists public.workshop_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_name text,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  scam_or_legit_score integer,
  scam_or_legit jsonb not null default '{}'::jsonb,
  scenarios_score integer,
  scenarios jsonb not null default '{}'::jsonb,
  passphrase jsonb not null default '{}'::jsonb,
  phone_audit jsonb not null default '{}'::jsonb,
  stop_check_report_score integer,
  stop_check_report jsonb not null default '{}'::jsonb,
  pledge jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.workshop_responses enable row level security;

grant insert on table public.workshop_responses to anon;

drop policy if exists "Allow anonymous workshop inserts" on public.workshop_responses;

create policy "Allow anonymous workshop inserts"
on public.workshop_responses
for insert
to anon
with check (true);

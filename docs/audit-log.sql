-- Phase 10 — audit log for sensitive actions.
-- Run this in the Supabase SQL editor when you're ready to enable
-- server-side audit logging. We keep it out of the auto-applied
-- migrations because the user asked to maintain the existing schema
-- as-is and review schema changes manually.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

-- Only the service role writes/reads this table. Users never see it.
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

-- Admins (per has_role) may read; nobody else.
create policy "Admins read audit log"
  on public.audit_log
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index if not exists audit_log_user_id_created_at_idx
  on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_action_created_at_idx
  on public.audit_log (action, created_at desc);

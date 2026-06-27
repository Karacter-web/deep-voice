-- Voice Studio schema (Pass A). Apply manually in the Supabase SQL editor.
-- Coexists with the existing voice_models / voice_samples tables.

create extension if not exists vector;

-- ============== ENUMS ==============
do $$ begin
  create type public.voice_profile_mode as enum ('clone', 'design', 'instant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.voice_profile_status as enum ('draft','processing','ready','failed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.voice_job_kind as enum (
    'clone_train','design_synth','instant_generate','enhance','diarize','preview'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.voice_job_status as enum ('queued','running','succeeded','failed','cancelled');
exception when duplicate_object then null; end $$;

-- ============== voice_profiles ==============
create table if not exists public.voice_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  mode          public.voice_profile_mode not null default 'clone',
  status        public.voice_profile_status not null default 'draft',
  language      text not null default 'en',
  gender        text,
  age           text,
  style         text,
  -- mode-specific knobs (timbre, prosody, accent, instant prompt, ...)
  params        jsonb not null default '{}'::jsonb,
  -- reference to provider artifacts after training/generation
  artifacts     jsonb not null default '{}'::jsonb,
  preview_path  text,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists voice_profiles_user_idx on public.voice_profiles(user_id, created_at desc);
create index if not exists voice_profiles_status_idx on public.voice_profiles(status);

grant select, insert, update, delete on public.voice_profiles to authenticated;
grant all on public.voice_profiles to service_role;

alter table public.voice_profiles enable row level security;

drop policy if exists "voice_profiles_owner_all" on public.voice_profiles;
create policy "voice_profiles_owner_all" on public.voice_profiles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "voice_profiles_public_read" on public.voice_profiles;
create policy "voice_profiles_public_read" on public.voice_profiles
  for select to authenticated using (is_public = true);

drop trigger if exists trg_voice_profiles_updated on public.voice_profiles;
create trigger trg_voice_profiles_updated
  before update on public.voice_profiles
  for each row execute function public.update_updated_at_column();

-- ============== voice_embeddings (pgvector) ==============
create table if not exists public.voice_embeddings (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.voice_profiles(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null default 'speaker', -- speaker | style | content
  embedding    vector(192),
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists voice_embeddings_profile_idx on public.voice_embeddings(profile_id);
-- ivfflat needs ANALYZE + data; safe to create empty.
create index if not exists voice_embeddings_vec_idx
  on public.voice_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

grant select, insert, update, delete on public.voice_embeddings to authenticated;
grant all on public.voice_embeddings to service_role;

alter table public.voice_embeddings enable row level security;

drop policy if exists "voice_embeddings_owner_all" on public.voice_embeddings;
create policy "voice_embeddings_owner_all" on public.voice_embeddings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== voice_jobs (async work queue) ==============
create table if not exists public.voice_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid references public.voice_profiles(id) on delete cascade,
  kind           public.voice_job_kind not null,
  status         public.voice_job_status not null default 'queued',
  input          jsonb not null default '{}'::jsonb,
  result         jsonb not null default '{}'::jsonb,
  error          text,
  progress       int  not null default 0, -- 0..100
  attempts       int  not null default 0,
  scheduled_at   timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists voice_jobs_user_idx on public.voice_jobs(user_id, created_at desc);
create index if not exists voice_jobs_status_idx on public.voice_jobs(status, scheduled_at);
create index if not exists voice_jobs_profile_idx on public.voice_jobs(profile_id);

grant select, insert, update, delete on public.voice_jobs to authenticated;
grant all on public.voice_jobs to service_role;

alter table public.voice_jobs enable row level security;

drop policy if exists "voice_jobs_owner_all" on public.voice_jobs;
create policy "voice_jobs_owner_all" on public.voice_jobs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_voice_jobs_updated on public.voice_jobs;
create trigger trg_voice_jobs_updated
  before update on public.voice_jobs
  for each row execute function public.update_updated_at_column();

-- realtime for live job status
alter publication supabase_realtime add table public.voice_jobs;

-- ============== voice_usage_logs ==============
create table if not exists public.voice_usage_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid references public.voice_profiles(id) on delete set null,
  job_id        uuid references public.voice_jobs(id) on delete set null,
  action        text not null, -- synth | clone | enhance | diarize | preview
  characters    int not null default 0,
  seconds       numeric not null default 0,
  cost_units    numeric not null default 0,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists voice_usage_user_idx on public.voice_usage_logs(user_id, created_at desc);

grant select, insert on public.voice_usage_logs to authenticated;
grant all on public.voice_usage_logs to service_role;

alter table public.voice_usage_logs enable row level security;

drop policy if exists "voice_usage_owner_read" on public.voice_usage_logs;
create policy "voice_usage_owner_read" on public.voice_usage_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "voice_usage_owner_insert" on public.voice_usage_logs;
create policy "voice_usage_owner_insert" on public.voice_usage_logs
  for insert to authenticated with check (auth.uid() = user_id);

-- ============== voice_quotas ==============
create table if not exists public.voice_quotas (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  tier               text not null default 'free',
  monthly_chars      int not null default 10000,
  monthly_seconds    int not null default 600,
  used_chars         int not null default 0,
  used_seconds       numeric not null default 0,
  period_started_at  timestamptz not null default date_trunc('month', now()),
  updated_at         timestamptz not null default now()
);

grant select on public.voice_quotas to authenticated;
grant all on public.voice_quotas to service_role;

alter table public.voice_quotas enable row level security;

drop policy if exists "voice_quotas_owner_read" on public.voice_quotas;
create policy "voice_quotas_owner_read" on public.voice_quotas
  for select to authenticated using (auth.uid() = user_id);

-- ============== quota helpers (security definer) ==============
create or replace function public.ensure_voice_quota(_user_id uuid)
returns public.voice_quotas
language plpgsql security definer set search_path = public as $$
declare q public.voice_quotas;
begin
  insert into public.voice_quotas(user_id) values (_user_id)
    on conflict (user_id) do nothing;
  select * into q from public.voice_quotas where user_id = _user_id;
  -- roll period
  if q.period_started_at < date_trunc('month', now()) then
    update public.voice_quotas
       set used_chars = 0, used_seconds = 0,
           period_started_at = date_trunc('month', now()),
           updated_at = now()
     where user_id = _user_id
     returning * into q;
  end if;
  return q;
end $$;

create or replace function public.consume_voice_quota(
  _user_id uuid, _chars int default 0, _seconds numeric default 0
) returns boolean
language plpgsql security definer set search_path = public as $$
declare q public.voice_quotas;
begin
  q := public.ensure_voice_quota(_user_id);
  if q.used_chars + _chars > q.monthly_chars then return false; end if;
  if q.used_seconds + _seconds > q.monthly_seconds then return false; end if;
  update public.voice_quotas
     set used_chars = used_chars + _chars,
         used_seconds = used_seconds + _seconds,
         updated_at = now()
   where user_id = _user_id;
  return true;
end $$;

revoke all on function public.ensure_voice_quota(uuid) from public;
revoke all on function public.consume_voice_quota(uuid,int,numeric) from public;
grant execute on function public.ensure_voice_quota(uuid) to authenticated, service_role;
grant execute on function public.consume_voice_quota(uuid,int,numeric) to authenticated, service_role;

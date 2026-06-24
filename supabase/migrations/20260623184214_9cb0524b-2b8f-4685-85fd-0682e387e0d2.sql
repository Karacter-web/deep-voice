
-- =========================================================
-- Enums
-- =========================================================
create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.voice_model_status as enum ('draft', 'training', 'ready', 'failed');
create type public.call_provider as enum ('web', 'telegram', 'whatsapp', 'discord', 'other');
create type public.call_status as enum ('active', 'ended', 'failed');

-- =========================================================
-- Generic updated_at trigger function
-- =========================================================
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- profiles
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated using (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- =========================================================
-- user_roles
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- voice_models
-- =========================================================
create table public.voice_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  source_language text not null default 'en',
  target_language text not null default 'en',
  character_preset text,
  provider text not null default 'whisper-cpp+rvc',
  status public.voice_model_status not null default 'draft',
  settings jsonb not null default '{}'::jsonb,
  sample_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index voice_models_user_id_idx on public.voice_models(user_id);

grant select, insert, update, delete on public.voice_models to authenticated;
grant all on public.voice_models to service_role;

alter table public.voice_models enable row level security;

create policy "Users manage their own voice models"
  on public.voice_models for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger voice_models_updated_at
  before update on public.voice_models
  for each row execute function public.update_updated_at_column();

-- =========================================================
-- voice_samples
-- =========================================================
create table public.voice_samples (
  id uuid primary key default gen_random_uuid(),
  voice_model_id uuid not null references public.voice_models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  filename text,
  duration_seconds numeric,
  sample_rate integer,
  transcript text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index voice_samples_model_idx on public.voice_samples(voice_model_id);
create index voice_samples_user_idx on public.voice_samples(user_id);

grant select, insert, update, delete on public.voice_samples to authenticated;
grant all on public.voice_samples to service_role;

alter table public.voice_samples enable row level security;

create policy "Users manage their own voice samples"
  on public.voice_samples for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep voice_models.sample_count in sync
create or replace function public.sync_voice_sample_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.voice_models
      set sample_count = sample_count + 1, updated_at = now()
      where id = new.voice_model_id;
  elsif tg_op = 'DELETE' then
    update public.voice_models
      set sample_count = greatest(sample_count - 1, 0), updated_at = now()
      where id = old.voice_model_id;
  end if;
  return null;
end;
$$;

create trigger voice_samples_count_ins
  after insert on public.voice_samples
  for each row execute function public.sync_voice_sample_count();

create trigger voice_samples_count_del
  after delete on public.voice_samples
  for each row execute function public.sync_voice_sample_count();

-- =========================================================
-- call_sessions
-- =========================================================
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_model_id uuid references public.voice_models(id) on delete set null,
  provider public.call_provider not null default 'web',
  status public.call_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index call_sessions_user_idx on public.call_sessions(user_id);

grant select, insert, update, delete on public.call_sessions to authenticated;
grant all on public.call_sessions to service_role;

alter table public.call_sessions enable row level security;

create policy "Users manage their own call sessions"
  on public.call_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- user_settings
-- =========================================================
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_voice_model_id uuid references public.voice_models(id) on delete set null,
  stt_model text not null default 'whisper-cpp',
  theme text not null default 'system',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_settings to authenticated;
grant all on public.user_settings to service_role;

alter table public.user_settings enable row level security;

create policy "Users manage their own settings"
  on public.user_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.update_updated_at_column();

-- =========================================================
-- Auto-create profile + default role + settings on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Storage RLS for voice-samples and avatars buckets
-- (buckets themselves are created via the storage tool)
-- =========================================================
create policy "Users read their own voice samples"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice-samples' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload their own voice samples"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-samples' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update their own voice samples"
  on storage.objects for update to authenticated
  using (bucket_id = 'voice-samples' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete their own voice samples"
  on storage.objects for delete to authenticated
  using (bucket_id = 'voice-samples' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Avatars are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

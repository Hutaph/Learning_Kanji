create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  full_name text,
  gender text,
  birth_date date,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists avatar_url text;

alter table public.user_state enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
drop policy if exists "user_state_insert_own" on public.user_state;
drop policy if exists "user_state_update_own" on public.user_state;
drop policy if exists "profiles_select_public_for_login" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "user_state_select_own"
  on public.user_state
  for select
  using (auth.uid() = user_id);

create policy "user_state_insert_own"
  on public.user_state
  for insert
  with check (auth.uid() = user_id);

create policy "user_state_update_own"
  on public.user_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_select_public_for_login"
  on public.profiles
  for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

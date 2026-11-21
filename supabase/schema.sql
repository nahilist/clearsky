-- ==============================================================================
-- ClearSky Weather: Supabase Database Schema
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. PROFILES TABLE (Linked with Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  lang text not null default 'en',
  is_pro boolean not null default false,
  temp_unit text not null default 'C',
  wind_unit text not null default 'kmh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger to automatically create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. USER SAVED PLACES TABLE
create table if not exists public.user_places (
  id text not null, -- place id e.g. "28.61,77.21" or uuid
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sub text,
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.user_places enable row level security;

create policy "Users can read own places"
  on public.user_places for select
  using (auth.uid() = user_id);

create policy "Users can insert own places"
  on public.user_places for insert
  with check (auth.uid() = user_id);

create policy "Users can update own places"
  on public.user_places for update
  using (auth.uid() = user_id);

create policy "Users can delete own places"
  on public.user_places for delete
  using (auth.uid() = user_id);


-- 3. USER CUSTOM WEATHER ALERT RULES (Pro Feature)
create table if not exists public.user_rules (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- rain, heat, cold, wind, uv
  threshold double precision not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.user_rules enable row level security;

create policy "Users can read own rules"
  on public.user_rules for select
  using (auth.uid() = user_id);

create policy "Users can insert own rules"
  on public.user_rules for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rules"
  on public.user_rules for update
  using (auth.uid() = user_id);

create policy "Users can delete own rules"
  on public.user_rules for delete
  using (auth.uid() = user_id);


-- 4. DEVICE TOKENS TABLE (For Push Notifications)
create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null, -- 'ios' | 'android'
  tz text not null,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.device_tokens enable row level security;

create policy "Users can read own device tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id or user_id is null);

create policy "Users can insert own device tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can update own device tokens"
  on public.device_tokens for update
  using (auth.uid() = user_id or user_id is null);

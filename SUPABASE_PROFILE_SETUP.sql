-- Ejecuta este script en Supabase SQL Editor para habilitar perfiles por usuario.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy if not exists "Users can view own profile"
on public.user_profiles
for select
using (auth.uid() = id);

create policy if not exists "Users can insert own profile"
on public.user_profiles
for insert
with check (auth.uid() = id);

create policy if not exists "Users can update own profile"
on public.user_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Migration: 001_foundation.sql
-- Description: Database foundation for Ayush Academia-Industry Collaboration Platform

-- 1. institutions table
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now()
);

-- 2. organizations table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text,
  location text,
  created_at timestamptz not null default now()
);

-- 3. profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null check (role in ('student', 'faculty', 'institution', 'industry')),
  phone text,
  institution_id uuid references public.institutions(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  program text,
  year integer,
  department text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. skills table
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  description text,
  source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_institution_id on public.profiles(institution_id);
create index if not exists idx_profiles_organization_id on public.profiles(organization_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

create index if not exists idx_skills_category on public.skills(category);
create index if not exists idx_skills_is_active on public.skills(is_active);

-- Enable Row Level Security (RLS) on all tables
alter table public.institutions enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.skills enable row level security;

-- Basic Safe RLS Policies

-- Institutions: Authenticated users can read institutions
drop policy if exists "Authenticated users can read institutions" on public.institutions;
create policy "Authenticated users can read institutions"
  on public.institutions
  for select
  to authenticated
  using (true);

-- Organizations: Authenticated users can read organizations
drop policy if exists "Authenticated users can read organizations" on public.organizations;
create policy "Authenticated users can read organizations"
  on public.organizations
  for select
  to authenticated
  using (true);

-- Skills: Authenticated users can read active skills
drop policy if exists "Authenticated users can read active skills" on public.skills;
create policy "Authenticated users can read active skills"
  on public.skills
  for select
  to authenticated
  using (is_active = true);

-- Profiles: Users can read and update only their own profile
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- (Note: No INSERT/UPDATE/DELETE policies are granted to public/authenticated roles
-- on institutions, organizations, or skills, which prevents modification through public client access)

-- updated_at trigger for profiles + role change protection
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  -- Security: Prevent standard authenticated users from self-escalating their assigned role
  if new.role is distinct from old.role and auth.role() = 'authenticated' then
    raise exception 'Unauthorized: Users cannot modify their own assigned role';
  end if;

  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- auth.users trigger to create profile upon user signup
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  -- Security: Do not allow arbitrary client-supplied signup metadata (raw_user_meta_data)
  -- to assign privileged roles (faculty, institution, industry).
  -- All self-registrations default strictly to 'student'.
  -- Privileged roles can only be granted via secure raw_app_meta_data (set by admin/service role)
  -- or assigned subsequently through an authorized invitation/verification process.
  if (new.raw_app_meta_data->>'role') in ('student', 'faculty', 'institution', 'industry') then
    assigned_role := new.raw_app_meta_data->>'role';
  else
    assigned_role := 'student';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    phone,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    assigned_role,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

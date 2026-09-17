-- Migration: 20260910163817_super_admin_core.sql
-- Description: Super Admin Core - Role Extension, Institution/Organization Verification, and Admin Functions

-- 1. Extend profiles role check constraint to include 'super_admin'
-- Safely drops the existing check constraint and adds the extended one without breaking existing roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'faculty', 'institution', 'industry', 'super_admin'));

-- 2. Add verification_status, category, location to public.institutions if not present
alter table public.institutions
  add column if not exists category text default 'Ayurveda College',
  add column if not exists location text default 'India',
  add column if not exists verification_status text not null default 'approved'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended'));

create index if not exists idx_institutions_verification_status
  on public.institutions(verification_status);

-- 3. Add verification_status to public.organizations if not present
alter table public.organizations
  add column if not exists verification_status text not null default 'approved'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended'));

create index if not exists idx_organizations_verification_status
  on public.organizations(verification_status);

-- 4. Helper Security Definer function to check if current caller is super_admin
-- Uses SET search_path = public and avoids recursive policies on public.profiles
create or replace function public.is_super_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role into user_role
  from public.profiles
  where id = auth.uid();

  return user_role = 'super_admin';
end;
$$;

revoke execute on function public.is_super_admin() from public;
revoke execute on function public.is_super_admin() from anon;
grant execute on function public.is_super_admin() to authenticated;

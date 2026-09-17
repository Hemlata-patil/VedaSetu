-- Migration: 20260911082500_onboarding_account_provisioning.sql
-- Description: Onboarding Account Provisioning — Faculty Designation and Account Association Foundation

-- =============================================================================
-- 1. ADD FACULTY DESIGNATION TO PUBLIC.PROFILES
-- =============================================================================

-- Add designation text column to public.profiles if not present
-- Note: Primarily used for academic titles (e.g., Professor, Associate Professor, HOD, Dean, etc.)
-- No check constraint added to allow future academic titles and flexible organizational roles.
alter table public.profiles
  add column if not exists designation text;

-- Index for searching and filtering by designation
create index if not exists idx_profiles_designation
  on public.profiles(designation);

-- Composite index for fast institution cohort directory lookups
create index if not exists idx_profiles_institution_role
  on public.profiles(institution_id, role);

-- =============================================================================
-- 2. UPDATE HANDLE_NEW_USER TRIGGER FUNCTION
-- =============================================================================

-- Update public.handle_new_user() to seamlessly capture department & designation
-- from user_metadata during server-side provisioning, while strictly safeguarding role assignment.
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  -- Security: Do not allow arbitrary client-supplied signup metadata (raw_user_meta_data)
  -- to assign privileged roles (faculty, institution, industry, super_admin).
  -- All self-registrations default strictly to 'student'.
  -- Privileged roles can only be granted via secure raw_app_meta_data (set by admin/service role).
  if (new.raw_app_meta_data->>'role') in ('student', 'faculty', 'institution', 'industry', 'super_admin') then
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
    department,
    designation,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    assigned_role,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'designation',
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$ language plpgsql;

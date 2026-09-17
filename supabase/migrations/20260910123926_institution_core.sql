-- Migration: 20260910123926_institution_core.sql
-- Description: Institution Core — Student Monitoring, Skill Profiling & Institutional Analytics
-- Module: Institutional Academic Governance MVP

-- =============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS (Zero RLS Recursion)
-- =============================================================================

-- 1.1 Helper: Get authenticated institution ID
create or replace function public.get_auth_institution_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_inst_id uuid;
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return null;
  end if;

  select role, institution_id into v_role, v_inst_id
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'institution' then
    return null;
  end if;

  return v_inst_id;
end;
$$;

revoke execute on function public.get_auth_institution_id() from public;
grant execute on function public.get_auth_institution_id() to authenticated;

-- 1.2 Helper: Evaluate if target student belongs to caller's authenticated institution
create or replace function public.is_student_in_auth_institution(target_student_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_inst_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  if target_student_id is null then
    return false;
  end if;

  -- get_auth_institution_id() verifies auth.uid() is not null and profile role = 'institution'
  v_inst_id := public.get_auth_institution_id();
  if v_inst_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles s
    where s.id = target_student_id
      and s.role = 'student'
      and s.institution_id is not null
      and s.institution_id = v_inst_id
  );
end;
$$;

revoke execute on function public.is_student_in_auth_institution(uuid) from public;
grant execute on function public.is_student_in_auth_institution(uuid) to authenticated;

-- =============================================================================
-- 2. PRIVACY-PRESERVING APPLICATION AGGREGATION RPCS
-- =============================================================================

-- 2.1 Aggregate application outcomes (institution-wide or student-specific)
-- Never exposes cover_note or individual application row details to institution.
create or replace function public.get_institution_application_stats(target_student_id uuid default null)
returns table (
  total_count bigint,
  applied_count bigint,
  under_review_count bigint,
  shortlisted_count bigint,
  selected_count bigint,
  rejected_count bigint,
  withdrawn_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_inst_id uuid;
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;

  select role, institution_id into v_role, v_inst_id
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'institution' or v_inst_id is null then
    return;
  end if;

  if target_student_id is not null then
    -- Verify target student belongs to caller's institution
    if not public.is_student_in_auth_institution(target_student_id) then
      return;
    end if;

    return query
    select
      count(*)::bigint as total_count,
      count(*) filter (where a.status = 'applied')::bigint as applied_count,
      count(*) filter (where a.status = 'under_review')::bigint as under_review_count,
      count(*) filter (where a.status = 'shortlisted')::bigint as shortlisted_count,
      count(*) filter (where a.status = 'selected')::bigint as selected_count,
      count(*) filter (where a.status = 'rejected')::bigint as rejected_count,
      count(*) filter (where a.status = 'withdrawn')::bigint as withdrawn_count
    from public.applications a
    where a.student_id = target_student_id;
  else
    -- Institution-wide aggregation
    return query
    select
      count(*)::bigint as total_count,
      count(*) filter (where a.status = 'applied')::bigint as applied_count,
      count(*) filter (where a.status = 'under_review')::bigint as under_review_count,
      count(*) filter (where a.status = 'shortlisted')::bigint as shortlisted_count,
      count(*) filter (where a.status = 'selected')::bigint as selected_count,
      count(*) filter (where a.status = 'rejected')::bigint as rejected_count,
      count(*) filter (where a.status = 'withdrawn')::bigint as withdrawn_count
    from public.applications a
    join public.profiles s on s.id = a.student_id
    where s.institution_id = v_inst_id
      and s.role = 'student';
  end if;
end;
$$;

revoke execute on function public.get_institution_application_stats(uuid) from public;
grant execute on function public.get_institution_application_stats(uuid) to authenticated;

-- 2.2 Student application count helper for directory views
create or replace function public.get_institution_student_application_counts()
returns table (
  student_id uuid,
  application_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_inst_id uuid;
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;

  select role, institution_id into v_role, v_inst_id
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'institution' or v_inst_id is null then
    return;
  end if;

  return query
  select
    a.student_id,
    count(*)::bigint as application_count
  from public.applications a
  join public.profiles s on s.id = a.student_id
  where s.institution_id = v_inst_id
    and s.role = 'student'
  group by a.student_id;
end;
$$;

revoke execute on function public.get_institution_student_application_counts() from public;
grant execute on function public.get_institution_student_application_counts() to authenticated;

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR INSTITUTION ROLE
-- =============================================================================

-- 3.1 PROFILES: Institution users can read students and faculty from their own institution
drop policy if exists "institution_select_cohort_profiles" on public.profiles;
create policy "institution_select_cohort_profiles"
  on public.profiles
  for select
  to authenticated
  using (
    role in ('student', 'faculty')
    and institution_id is not null
    and institution_id = public.get_auth_institution_id()
  );

-- 3.2 STUDENT_COMPETENCIES: Institution users can read competency results for their students
drop policy if exists "institution_select_cohort_competencies" on public.student_competencies;
create policy "institution_select_cohort_competencies"
  on public.student_competencies
  for select
  to authenticated
  using (
    public.is_student_in_auth_institution(student_id)
  );

-- 3.3 ASSESSMENT_ATTEMPTS: Institution users can read assessment attempts for their students
drop policy if exists "institution_select_cohort_attempts" on public.assessment_attempts;
create policy "institution_select_cohort_attempts"
  on public.assessment_attempts
  for select
  to authenticated
  using (
    public.is_student_in_auth_institution(student_id)
  );

-- 3.4 MENTORSHIPS: Institution users can read mentorship records where student belongs to institution
drop policy if exists "institution_select_cohort_mentorships" on public.mentorships;
create policy "institution_select_cohort_mentorships"
  on public.mentorships
  for select
  to authenticated
  using (
    public.is_student_in_auth_institution(student_id)
  );

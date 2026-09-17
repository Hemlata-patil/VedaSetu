-- Migration: 20260911005825_student_mentorship_requests.sql
-- Description: Student-initiated Mentorship Requests, Status Lifecycle, Partial Unique Index, and Institution-scoped Discovery RLS

-- =============================================================================
-- 1. EXTEND STATUS CHECK CONSTRAINT
-- =============================================================================

alter table public.mentorships drop constraint if exists mentorships_status_check;
alter table public.mentorships add constraint mentorships_status_check
  check (status in ('pending', 'active', 'completed', 'rejected'));

-- =============================================================================
-- 2. ADD REQUEST SOURCE AND STUDENT MESSAGE FIELDS
-- =============================================================================

-- Add requested_by to track whether faculty or student initiated the mentorship
alter table public.mentorships
  add column if not exists requested_by uuid references public.profiles(id) on delete set null;

-- Add request_note for student reason/message (mentor_note remains faculty-only guidance)
alter table public.mentorships
  add column if not exists request_note text;

-- Backfill any existing active/completed mentorships to have requested_by = faculty_id
update public.mentorships
set requested_by = faculty_id
where requested_by is null;

-- =============================================================================
-- 3. REPLACE TABLE-LEVEL UNIQUE CONSTRAINT WITH PARTIAL UNIQUE INDEX
-- =============================================================================

-- Drop the old rigid constraint that permanently blocked re-requests after rejection/completion
alter table public.mentorships
  drop constraint if exists uq_mentorships_faculty_student;

-- Enforce at most one pending or active mentorship between a student and faculty pair
create unique index if not exists idx_mentorships_active_or_pending
  on public.mentorships (faculty_id, student_id)
  where status in ('pending', 'active');

-- Index on requested_by for query performance
create index if not exists idx_mentorships_requested_by
  on public.mentorships (requested_by);

-- =============================================================================
-- 4. SECURITY DEFINER HELPERS (AVOIDS RLS RECURSION)
-- =============================================================================

-- 4.1 Helper to get authenticated student's institution_id
create or replace function public.get_auth_student_institution_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select institution_id
  from public.profiles
  where id = auth.uid()
    and role = 'student'
    and institution_id is not null;
$$;

revoke execute on function public.get_auth_student_institution_id() from public;
revoke execute on function public.get_auth_student_institution_id() from anon;
grant execute on function public.get_auth_student_institution_id() to authenticated;

-- 4.2 Helper to check if a target faculty belongs to caller student's institution
create or replace function public.is_faculty_in_auth_student_institution(target_faculty_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles s
    join public.profiles f on f.id = target_faculty_id
    where s.id = auth.uid()
      and s.role = 'student'
      and s.institution_id is not null
      and f.role = 'faculty'
      and f.institution_id is not null
      and f.institution_id = s.institution_id
  );
$$;

revoke execute on function public.is_faculty_in_auth_student_institution(uuid) from public;
revoke execute on function public.is_faculty_in_auth_student_institution(uuid) from anon;
grant execute on function public.is_faculty_in_auth_student_institution(uuid) to authenticated;

-- =============================================================================
-- 5. FACULTY DISCOVERY POLICY ON PUBLIC.PROFILES
-- =============================================================================

-- Narrow SELECT policy: Students can read faculty profiles belonging to their own institution
drop policy if exists "student_select_institution_faculty_profiles" on public.profiles;
create policy "student_select_institution_faculty_profiles"
  on public.profiles
  for select
  to authenticated
  using (
    role = 'faculty'
    and public.is_faculty_in_auth_student_institution(id)
  );

-- =============================================================================
-- 6. DEDICATED INSERT VALIDATION TRIGGER
-- =============================================================================

create or replace function public.validate_mentorship_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set default requested_by if omitted
  if new.requested_by is null then
    new.requested_by := coalesce(auth.uid(), new.faculty_id);
  end if;

  -- Initial status must be either pending (student request) or active (faculty creation)
  if new.status not in ('pending', 'active') then
    raise exception 'Initial mentorship status must be pending or active';
  end if;

  -- Student request cannot pre-fill faculty mentor_note
  if new.status = 'pending' then
    new.mentor_note := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mentorships_insert on public.mentorships;
create trigger trg_mentorships_insert
  before insert on public.mentorships
  for each row execute function public.validate_mentorship_insert();

-- =============================================================================
-- 7. DEDICATED UPDATE TRIGGER: IMMUTABILITY, STATUS TRANSITIONS & NOTE PRIVACY
-- =============================================================================

create or replace function public.set_mentorship_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Strict immutability checks
  if new.id is distinct from old.id then
    raise exception 'id is immutable';
  end if;

  if new.faculty_id is distinct from old.faculty_id then
    raise exception 'faculty_id is immutable';
  end if;

  if new.student_id is distinct from old.student_id then
    raise exception 'student_id is immutable';
  end if;

  if new.requested_by is distinct from old.requested_by then
    raise exception 'requested_by is immutable';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;

  -- 2. Note privacy & editing rules
  if new.mentor_note is distinct from old.mentor_note then
    if auth.uid() is not null and auth.uid() = old.student_id then
      raise exception 'Unauthorized: Students cannot modify mentor notes';
    end if;
  end if;

  if new.request_note is distinct from old.request_note then
    if auth.uid() is not null and auth.uid() = old.faculty_id then
      raise exception 'Unauthorized: Faculty cannot modify student request notes';
    end if;
    if old.status != 'pending' then
      raise exception 'request_note can only be edited while request is pending';
    end if;
  end if;

  -- 3. Status transition enforcement
  if new.status is distinct from old.status then
    -- Transition from pending: only allowed to active or rejected by assigned faculty
    if old.status = 'pending' then
      if new.status not in ('active', 'rejected') then
        raise exception 'Invalid transition: pending request can only transition to active or rejected, received %', new.status;
      end if;
      if auth.uid() is not null and auth.uid() != old.faculty_id and auth.role() = 'authenticated' then
        raise exception 'Unauthorized: Only the assigned faculty mentor can accept or reject a mentorship request';
      end if;
    -- Transition from active: only allowed to completed by assigned faculty
    elsif old.status = 'active' then
      if new.status != 'completed' then
        raise exception 'Invalid transition: active mentorship can only transition to completed, received %', new.status;
      end if;
      if auth.uid() is not null and auth.uid() != old.faculty_id and auth.role() = 'authenticated' then
        raise exception 'Unauthorized: Only the assigned faculty mentor can mark mentorship as completed';
      end if;
    -- Terminal states
    elsif old.status = 'completed' then
      raise exception 'Invalid transition: completed mentorship cannot be modified';
    elsif old.status = 'rejected' then
      raise exception 'Invalid transition: rejected mentorship cannot be modified';
    else
      raise exception 'Invalid mentorship status: %', old.status;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mentorships_updated_at on public.mentorships;
create trigger trg_mentorships_updated_at
  before update on public.mentorships
  for each row execute function public.set_mentorship_updated_at();

-- =============================================================================
-- 8. ROW LEVEL SECURITY POLICIES FOR MENTORSHIPS
-- =============================================================================

-- 8.1 Faculty Insert Policy: Faculty can create direct active mentorship for same-institution student
drop policy if exists "mentorships_insert_faculty" on public.mentorships;
create policy "mentorships_insert_faculty"
  on public.mentorships for insert
  to authenticated
  with check (
    faculty_id = auth.uid()
    and status = 'active'
    and (requested_by is null or requested_by = auth.uid())
    and exists (
      select 1 from public.profiles f, public.profiles s
      where f.id = auth.uid()
        and f.role = 'faculty'
        and f.institution_id is not null
        and s.id = mentorships.student_id
        and s.role = 'student'
        and s.institution_id is not null
        and s.institution_id = f.institution_id
    )
  );

-- 8.2 Student Insert Policy: Student can create pending request for same-institution faculty
drop policy if exists "mentorships_insert_student" on public.mentorships;
create policy "mentorships_insert_student"
  on public.mentorships for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and (requested_by is null or requested_by = auth.uid())
    and faculty_id is not null
    and public.is_faculty_in_auth_student_institution(faculty_id)
  );

-- 8.3 Student Update Policy: Student can only update their own pending request (e.g. edit request_note)
drop policy if exists "mentorships_update_student" on public.mentorships;
create policy "mentorships_update_student"
  on public.mentorships for update
  to authenticated
  using (
    student_id = auth.uid()
    and status = 'pending'
  )
  with check (
    student_id = auth.uid()
    and status = 'pending'
  );

-- 8.4 Faculty Update Policy: Faculty can accept/reject pending or complete active mentorship
-- (Existing policy is re-affirmed)
drop policy if exists "mentorships_update_faculty" on public.mentorships;
create policy "mentorships_update_faculty"
  on public.mentorships for update
  to authenticated
  using (faculty_id = auth.uid())
  with check (faculty_id = auth.uid());

-- 8.5 Student Select Policy: Student can view their own mentorship records (pending, active, completed, rejected)
-- (Existing policy is re-affirmed)
drop policy if exists "mentorships_select_student" on public.mentorships;
create policy "mentorships_select_student"
  on public.mentorships for select
  to authenticated
  using (student_id = auth.uid());

-- 8.6 Faculty Select Policy: Faculty can view their own mentorship records (all statuses)
-- (Existing policy is re-affirmed)
drop policy if exists "mentorships_select_faculty" on public.mentorships;
create policy "mentorships_select_faculty"
  on public.mentorships for select
  to authenticated
  using (faculty_id = auth.uid());

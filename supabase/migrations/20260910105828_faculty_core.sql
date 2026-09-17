-- Migration: 20260910105828_faculty_core.sql
-- Description: Faculty Core — Student Skill Monitoring + Mentorship
-- Module: Faculty Academic Supervision & Mentorship MVP

-- =============================================================================
-- 1. TABLE: public.mentorships
-- =============================================================================

create table if not exists public.mentorships (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed')),
  mentor_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_mentorships_faculty_student unique (faculty_id, student_id)
);

-- Indexes for performance
create index if not exists idx_mentorships_faculty_id on public.mentorships(faculty_id);
create index if not exists idx_mentorships_student_id on public.mentorships(student_id);
create index if not exists idx_mentorships_status on public.mentorships(status);

-- =============================================================================
-- 2. DEDICATED UPDATED_AT TRIGGER
-- =============================================================================

create or replace function public.set_mentorship_updated_at()
returns trigger as $$
begin
  -- Prevent modifying faculty_id or student_id
  if new.faculty_id is distinct from old.faculty_id then
    raise exception 'faculty_id is immutable';
  end if;

  if new.student_id is distinct from old.student_id then
    raise exception 'student_id is immutable';
  end if;

  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mentorships_updated_at on public.mentorships;
create trigger trg_mentorships_updated_at
  before update on public.mentorships
  for each row execute function public.set_mentorship_updated_at();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS) FOR MENTORSHIPS
-- =============================================================================

alter table public.mentorships enable row level security;

-- Faculty can select their own mentorship records
create policy "mentorships_select_faculty"
  on public.mentorships for select
  to authenticated
  using (faculty_id = auth.uid());

-- Faculty can insert mentorships for students in the same institution
create policy "mentorships_insert_faculty"
  on public.mentorships for insert
  to authenticated
  with check (
    faculty_id = auth.uid()
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

-- Faculty can update their own mentorships (note and status)
create policy "mentorships_update_faculty"
  on public.mentorships for update
  to authenticated
  using (faculty_id = auth.uid())
  with check (faculty_id = auth.uid());

-- Student can only select their own mentorship records
create policy "mentorships_select_student"
  on public.mentorships for select
  to authenticated
  using (student_id = auth.uid());

-- =============================================================================
-- 4. INSTITUTION-SCOPED FACULTY VISIBILITY POLICIES
-- =============================================================================

-- Helper function running as SECURITY DEFINER to avoid RLS infinite recursion
create or replace function public.get_auth_faculty_institution_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select institution_id
  from public.profiles
  where id = auth.uid()
    and role = 'faculty'
    and institution_id is not null;
$$;

-- 4.1 NARROW RLS SELECT POLICY ON PROFILES:
-- Allows authenticated faculty to read student profiles from their own institution.
-- Faculty cannot read other faculty, industry, institution profiles, or students from other institutions.
drop policy if exists "faculty_select_institution_student_profiles" on public.profiles;
create policy "faculty_select_institution_student_profiles"
  on public.profiles
  for select
  to authenticated
  using (
    role = 'student'
    and institution_id is not null
    and institution_id = public.get_auth_faculty_institution_id()
  );

-- 4.2 NARROW RLS SELECT POLICY ON STUDENT_COMPETENCIES:
-- Allows authenticated faculty to read competencies of students belonging to the same institution.
drop policy if exists "faculty_select_institution_student_competencies" on public.student_competencies;
create policy "faculty_select_institution_student_competencies"
  on public.student_competencies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles s
      where s.id = student_competencies.student_id
      and s.role = 'student'
      and s.institution_id is not null
      and s.institution_id = public.get_auth_faculty_institution_id()
    )
  );

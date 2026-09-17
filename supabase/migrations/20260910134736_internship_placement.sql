-- Migration: 20260910134736_internship_placement.sql
-- Description: Internship & Placement Tracking MVP
-- Module: Candidate Engagement, Onboarding, and Outcome Tracking

-- =============================================================================
-- 1. TABLE DEFINITION
-- =============================================================================

create table if not exists public.internship_placements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  engagement_type text not null check (engagement_type in ('internship', 'placement')),
  status text not null default 'selected' check (status in ('selected', 'offer_accepted', 'joined', 'in_progress', 'completed', 'withdrawn')),
  start_date date,
  expected_end_date date,
  actual_end_date date,
  progress_percent numeric not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  supervisor_name text,
  supervisor_email text,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_internship_placements_application unique (application_id),
  constraint chk_expected_end_date check (expected_end_date is null or start_date is null or expected_end_date >= start_date),
  constraint chk_actual_end_date check (actual_end_date is null or start_date is null or actual_end_date >= start_date)
);

-- Indexes for performance
create index if not exists idx_internship_placements_application_id on public.internship_placements(application_id);
create index if not exists idx_internship_placements_status on public.internship_placements(status);
create index if not exists idx_internship_placements_engagement_type on public.internship_placements(engagement_type);

-- =============================================================================
-- 2. VALIDATION & MUTABILITY TRIGGERS
-- =============================================================================

-- 2.1 Validation on Insert:
-- Must reference an application whose status is 'selected'
-- Must be created by the industry opportunity owner
create or replace function public.validate_internship_placement_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_status text;
  v_opp_creator uuid;
begin
  -- Fetch application status and opportunity creator
  select a.status, o.created_by
  into v_app_status, v_opp_creator
  from public.applications a
  join public.opportunities o on o.id = a.opportunity_id
  where a.id = new.application_id;

  if v_app_status is null then
    raise exception 'Referenced application does not exist.';
  end if;

  if v_app_status != 'selected' then
    raise exception 'Internship/placement tracking can only be initiated for applications with status "selected" (current status: %).', v_app_status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_internship_placement_insert on public.internship_placements;
create trigger trg_validate_internship_placement_insert
  before insert on public.internship_placements
  for each row
  execute function public.validate_internship_placement_insert();

-- 2.2 Mutation, State Machine, and Immutability Trigger on Update
create or replace function public.handle_internship_placement_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Protect immutable fields
  if old.id is distinct from new.id then
    raise exception 'Placement ID is immutable.';
  end if;

  if old.application_id is distinct from new.application_id then
    raise exception 'application_id is immutable.';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'created_at is immutable.';
  end if;

  -- Validate status state machine transitions:
  -- selected -> offer_accepted
  -- selected -> withdrawn
  -- offer_accepted -> joined
  -- offer_accepted -> withdrawn
  -- joined -> in_progress
  -- in_progress -> completed
  -- Terminal states: completed -> no changes, withdrawn -> no changes
  if old.status is distinct from new.status then
    if old.status = 'completed' or old.status = 'withdrawn' then
      raise exception 'Cannot transition from terminal state "%".', old.status;
    end if;

    if old.status = 'selected' and new.status not in ('offer_accepted', 'withdrawn') then
      raise exception 'Invalid transition from "selected" to "%".', new.status;
    elsif old.status = 'offer_accepted' and new.status not in ('joined', 'withdrawn') then
      raise exception 'Invalid transition from "offer_accepted" to "%".', new.status;
    elsif old.status = 'joined' and new.status not in ('in_progress') then
      raise exception 'Invalid transition from "joined" to "%".', new.status;
    elsif old.status = 'in_progress' and new.status not in ('completed') then
      raise exception 'Invalid transition from "in_progress" to "%".', new.status;
    end if;
  end if;

  -- Update updated_at timestamp
  new.updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_internship_placements_update on public.internship_placements;
create trigger trg_internship_placements_update
  before update on public.internship_placements
  for each row
  execute function public.handle_internship_placement_update();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.internship_placements enable row level security;

-- 3.1 STUDENT SELECT:
-- Student can only read records where the linked application's student_id = auth.uid()
drop policy if exists "internship_placements_student_select" on public.internship_placements;
create policy "internship_placements_student_select"
  on public.internship_placements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = internship_placements.application_id
        and a.student_id = auth.uid()
    )
  );

-- 3.2 INDUSTRY SELECT:
-- Industry can only read records where linked application opportunity was created by auth.uid()
drop policy if exists "internship_placements_industry_select" on public.internship_placements;
create policy "internship_placements_industry_select"
  on public.internship_placements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = internship_placements.application_id
        and o.created_by = auth.uid()
    )
  );

-- 3.3 INDUSTRY INSERT:
-- Industry can create a record only when the selected application belongs to an opportunity created by auth.uid()
drop policy if exists "internship_placements_industry_insert" on public.internship_placements;
create policy "internship_placements_industry_insert"
  on public.internship_placements
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = application_id
        and o.created_by = auth.uid()
        and a.status = 'selected'
    )
  );

-- 3.4 INDUSTRY UPDATE:
-- Industry can update only records whose opportunity was created by auth.uid()
drop policy if exists "internship_placements_industry_update" on public.internship_placements;
create policy "internship_placements_industry_update"
  on public.internship_placements
  for update
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = internship_placements.application_id
        and o.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = internship_placements.application_id
        and o.created_by = auth.uid()
    )
  );

-- 3.5 FACULTY SELECT:
-- Faculty can read placement records for students belonging to their own institution
drop policy if exists "internship_placements_faculty_select" on public.internship_placements;
create policy "internship_placements_faculty_select"
  on public.internship_placements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.profiles s on s.id = a.student_id
      where a.id = internship_placements.application_id
        and s.role = 'student'
        and s.institution_id is not null
        and s.institution_id = public.get_auth_faculty_institution_id()
    )
  );

-- 3.6 INSTITUTION SELECT:
-- Institution can read placement records for students belonging to their institution
drop policy if exists "internship_placements_institution_select" on public.internship_placements;
create policy "internship_placements_institution_select"
  on public.internship_placements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.profiles s on s.id = a.student_id
      where a.id = internship_placements.application_id
        and s.role = 'student'
        and s.institution_id is not null
        and s.institution_id = public.get_auth_institution_id()
    )
  );

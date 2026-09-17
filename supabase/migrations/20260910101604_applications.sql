-- Migration: 20260910101604_applications.sql
-- Description: Student Applications and Industry Candidate Management MVP
-- Module: Applications & Candidate Review

-- =============================================================================
-- 1. TABLE: public.applications
-- =============================================================================

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'under_review', 'shortlisted', 'rejected', 'selected', 'withdrawn')),
  cover_note text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_applications_opportunity_student unique (opportunity_id, student_id)
);

-- Indexes for efficient queries
create index if not exists idx_applications_opportunity_id on public.applications(opportunity_id);
create index if not exists idx_applications_student_id on public.applications(student_id);
create index if not exists idx_applications_status on public.applications(status);

-- =============================================================================
-- 2. DATABASE-LEVEL PROTECTION & LIFECYCLE ENFORCEMENT TRIGGER
-- =============================================================================

create or replace function public.handle_application_update()
returns trigger as $$
declare
  is_student boolean;
  is_industry_owner boolean;
begin
  -- 1. Column-Level Immutability: Certain columns can never be modified
  if new.id is distinct from old.id then
    raise exception 'Application ID is immutable';
  end if;

  if new.student_id is distinct from old.student_id then
    raise exception 'student_id is immutable';
  end if;

  if new.opportunity_id is distinct from old.opportunity_id then
    raise exception 'opportunity_id is immutable';
  end if;

  if new.applied_at is distinct from old.applied_at then
    raise exception 'applied_at timestamp is immutable';
  end if;

  -- 2. Identify caller context (using auth.uid())
  is_student := (auth.uid() = old.student_id);
  
  select exists (
    select 1 from public.opportunities o
    where o.id = old.opportunity_id and o.created_by = auth.uid()
  ) into is_industry_owner;

  -- 3. Student-specific mutability rules
  if is_student then
    -- Cover note can only be modified while status is 'applied'
    if new.cover_note is distinct from old.cover_note and old.status != 'applied' then
      raise exception 'Cover note cannot be modified after review has started';
    end if;

    -- Status transition checks for students
    if new.status is distinct from old.status then
      if new.status != 'withdrawn' then
        raise exception 'Students can only transition an application to withdrawn';
      end if;

      if old.status not in ('applied', 'under_review') then
        raise exception 'Applications cannot be withdrawn after shortlisting, selection, or rejection';
      end if;
    end if;

  -- 4. Industry-specific mutability rules
  elsif is_industry_owner then
    -- Industry owners may not modify the student cover note
    if new.cover_note is distinct from old.cover_note then
      raise exception 'Industry owners cannot modify the student cover note';
    end if;

    -- Strict lifecycle transition state machine for industry
    if new.status is distinct from old.status then
      if old.status = 'applied' and new.status = 'under_review' then
        -- Allowed: applied -> under_review
        null;
      elsif old.status = 'under_review' and new.status in ('shortlisted', 'rejected') then
        -- Allowed: under_review -> shortlisted or rejected
        null;
      elsif old.status = 'shortlisted' and new.status in ('selected', 'rejected') then
        -- Allowed: shortlisted -> selected or rejected
        null;
      else
        raise exception 'Invalid status transition from % to % for industry', old.status, new.status;
      end if;
    end if;

  -- 5. If caller is neither the student nor the opportunity creator
  else
    raise exception 'Unauthorized to update this application';
  end if;

  -- Always bump updated_at timestamp
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_applications_update on public.applications;
create trigger trg_applications_update
  before update on public.applications
  for each row execute function public.handle_application_update();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =============================================================================

alter table public.applications enable row level security;

-- -----------------------------------------------------------------------------
-- 3.1 STUDENT RLS POLICIES
-- -----------------------------------------------------------------------------

-- Students can view their own applications
create policy "applications_select_student"
  on public.applications for select
  to authenticated
  using (student_id = auth.uid());

-- Students can insert applications for themselves on published opportunities
create policy "applications_insert_student"
  on public.applications for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'applied'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
    and exists (
      select 1 from public.opportunities o
      where o.id = applications.opportunity_id
      and o.status = 'published'
    )
  );

-- Students can update their own application (further verified by trigger)
create policy "applications_update_student"
  on public.applications for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3.2 INDUSTRY RLS POLICIES
-- -----------------------------------------------------------------------------

-- Industry users can view applications for opportunities they own
create policy "applications_select_industry"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = applications.opportunity_id
      and o.created_by = auth.uid()
    )
  );

-- Industry users can update applications for opportunities they own
create policy "applications_update_industry"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = applications.opportunity_id
      and o.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.opportunities o
      where o.id = applications.opportunity_id
      and o.created_by = auth.uid()
    )
  );

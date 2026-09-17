-- Migration: 20260910125626_faculty_collaboration.sql
-- Description: Faculty FDP + Research + Industry Collaboration MVP
-- Module: Faculty Collaboration, FDP Discovery, and Research Interest Tracking

-- =============================================================================
-- 1. TABLES DEFINITION
-- =============================================================================

-- 1.1 Faculty Opportunities Table
create table if not exists public.faculty_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  opportunity_type text not null check (opportunity_type in ('fdp', 'workshop', 'research_project', 'industry_collaboration')),
  provider_name text,
  location text,
  mode text check (mode in ('onsite', 'hybrid', 'remote')),
  start_date date,
  end_date date,
  application_deadline date,
  external_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.2 Faculty Opportunity Interests Table
create table if not exists public.faculty_opportunity_interests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.faculty_opportunities(id) on delete restrict,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'interested' check (status in ('interested', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, faculty_id)
);

-- Indexes for performance
create index if not exists idx_faculty_opportunities_status on public.faculty_opportunities(status);
create index if not exists idx_faculty_opportunities_type on public.faculty_opportunities(opportunity_type);
create index if not exists idx_faculty_opportunities_created_by on public.faculty_opportunities(created_by);
create index if not exists idx_faculty_opportunity_interests_faculty_id on public.faculty_opportunity_interests(faculty_id);
create index if not exists idx_faculty_opportunity_interests_opportunity_id on public.faculty_opportunity_interests(opportunity_id);
create index if not exists idx_faculty_opportunity_interests_status on public.faculty_opportunity_interests(status);

-- =============================================================================
-- 2. UPDATED_AT TRIGGERS (Dedicated functions, do not touch handle_updated_at)
-- =============================================================================

create or replace function public.set_faculty_opportunity_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_faculty_opportunity_updated_at on public.faculty_opportunities;
create trigger trg_set_faculty_opportunity_updated_at
  before update on public.faculty_opportunities
  for each row
  execute function public.set_faculty_opportunity_updated_at();

create or replace function public.set_faculty_interest_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_faculty_interest_updated_at on public.faculty_opportunity_interests;
create trigger trg_set_faculty_interest_updated_at
  before update on public.faculty_opportunity_interests
  for each row
  execute function public.set_faculty_interest_updated_at();

-- =============================================================================
-- 3. VALIDATION & IMMUTABILITY TRIGGERS
-- =============================================================================

-- 3.1 Organization validation on faculty opportunity insert/update
-- Ensures that organization_id is legitimately associated with the creator
create or replace function public.validate_faculty_opportunity_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst_id uuid;
  v_caller_org_id uuid;
begin
  -- If organization_id is null, it is allowed
  if new.organization_id is null then
    return new;
  end if;

  select role, institution_id, organization_id
  into v_caller_role, v_caller_inst_id, v_caller_org_id
  from public.profiles
  where id = new.created_by;

  -- For faculty creators: institution_id must match organization_id if organization_id is set
  if v_caller_role = 'faculty' then
    if v_caller_inst_id is null then
      raise exception 'Faculty without an affiliated institution cannot attach an organization.';
    end if;
    if v_caller_org_id is distinct from new.organization_id and v_caller_inst_id is distinct from new.organization_id then
      raise exception 'Faculty creators can only attach their own affiliated institution/organization.';
    end if;
  elsif v_caller_role = 'industry' then
    if v_caller_org_id is distinct from new.organization_id then
      raise exception 'Industry creators can only attach their own organization.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_faculty_opportunity_organization on public.faculty_opportunities;
create trigger trg_validate_faculty_opportunity_organization
  before insert or update on public.faculty_opportunities
  for each row
  execute function public.validate_faculty_opportunity_organization();

-- 3.2 Immutability and State Transition Trigger on faculty_opportunity_interests
create or replace function public.validate_faculty_interest_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_opp_created_by uuid;
  v_is_owner boolean;
  v_is_applicant boolean;
begin
  v_uid := auth.uid();

  -- Protect immutable fields on update:
  -- faculty_id, opportunity_id, created_at can NEVER be modified
  if old.faculty_id is distinct from new.faculty_id then
    raise exception 'Modifying faculty_id on interest records is strictly prohibited.';
  end if;

  if old.opportunity_id is distinct from new.opportunity_id then
    raise exception 'Modifying opportunity_id on interest records is strictly prohibited.';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'Modifying created_at on interest records is strictly prohibited.';
  end if;

  -- Lookup opportunity creator (the owner)
  select created_by into v_opp_created_by
  from public.faculty_opportunities
  where id = old.opportunity_id;

  v_is_owner := (v_uid is not null and v_opp_created_by = v_uid);
  v_is_applicant := (v_uid is not null and old.faculty_id = v_uid);

  -- 1. Faculty applicant flow
  if v_is_applicant and not v_is_owner then
    -- Applicant cannot touch status unless withdrawing
    if old.status is distinct from new.status then
      if new.status = 'withdrawn' then
        if old.status not in ('interested', 'under_review') then
          raise exception 'Cannot withdraw interest after it has been accepted or rejected.';
        end if;
      else
        raise exception 'Faculty applicants cannot directly set status to %', new.status;
      end if;
    end if;

    -- Applicant can only modify message while status = 'interested'
    if old.message is distinct from new.message and old.status != 'interested' then
      raise exception 'Message cannot be modified once interest is under review or decided.';
    end if;

  -- 2. Opportunity owner flow
  elsif v_is_owner then
    -- Owner must NOT modify applicant's message
    if old.message is distinct from new.message then
      raise exception 'Opportunity owners cannot modify applicant messages.';
    end if;

    -- Owner status transition state machine:
    -- interested -> under_review
    -- under_review -> accepted
    -- under_review -> rejected
    if old.status is distinct from new.status then
      if old.status = 'interested' and new.status = 'under_review' then
        -- Valid
      elsif old.status = 'under_review' and new.status in ('accepted', 'rejected') then
        -- Valid
      else
        raise exception 'Invalid status transition from % to % by opportunity owner.', old.status, new.status;
      end if;
    end if;

  else
    -- Neither applicant nor owner
    raise exception 'Unauthorized to modify this interest record.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_faculty_interest_mutation on public.faculty_opportunity_interests;
create trigger trg_validate_faculty_interest_mutation
  before update on public.faculty_opportunity_interests
  for each row
  execute function public.validate_faculty_interest_mutation();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES & HELPERS
-- =============================================================================

-- Helper running as SECURITY DEFINER to avoid RLS restrictions when checking caller role
create or replace function public.get_auth_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

revoke execute on function public.get_auth_profile_role() from public;
grant execute on function public.get_auth_profile_role() to authenticated;

alter table public.faculty_opportunities enable row level security;
alter table public.faculty_opportunity_interests enable row level security;

-- -----------------------------------------------------------------------------
-- 4.1 faculty_opportunities Policies
-- -----------------------------------------------------------------------------

-- SELECT:
-- 1. Opportunity owner (created_by = auth.uid()) can see their own in any status
-- 2. Non-students can see 'published' opportunities
drop policy if exists "faculty_opportunities_select" on public.faculty_opportunities;
create policy "faculty_opportunities_select"
  on public.faculty_opportunities
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or (
      status = 'published'
      and public.get_auth_profile_role() in ('faculty', 'institution', 'industry')
    )
  );

-- INSERT:
-- Authenticated users with role in ('faculty', 'institution', 'industry') where created_by = auth.uid()
drop policy if exists "faculty_opportunities_insert" on public.faculty_opportunities;
create policy "faculty_opportunities_insert"
  on public.faculty_opportunities
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.get_auth_profile_role() in ('faculty', 'institution', 'industry')
  );

-- UPDATE:
-- Only opportunity owner (created_by = auth.uid()) can update their own opportunity
drop policy if exists "faculty_opportunities_update" on public.faculty_opportunities;
create policy "faculty_opportunities_update"
  on public.faculty_opportunities
  for update
  to authenticated
  using (
    created_by = auth.uid()
  )
  with check (
    created_by = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 4.2 faculty_opportunity_interests Policies
-- -----------------------------------------------------------------------------

-- SELECT:
-- 1. Faculty can select their own interests (faculty_id = auth.uid())
-- 2. Opportunity owner can select interests submitted to opportunities they created
drop policy if exists "faculty_interests_select" on public.faculty_opportunity_interests;
create policy "faculty_interests_select"
  on public.faculty_opportunity_interests
  for select
  to authenticated
  using (
    faculty_id = auth.uid()
    or exists (
      select 1 from public.faculty_opportunities opp
      where opp.id = opportunity_id
        and opp.created_by = auth.uid()
    )
  );

-- INSERT:
-- Only authenticated users with role = 'faculty' inserting for themselves (faculty_id = auth.uid())
drop policy if exists "faculty_interests_insert" on public.faculty_opportunity_interests;
create policy "faculty_interests_insert"
  on public.faculty_opportunity_interests
  for insert
  to authenticated
  with check (
    faculty_id = auth.uid()
    and status = 'interested'
    and public.get_auth_profile_role() = 'faculty'
    and exists (
      select 1 from public.faculty_opportunities opp
      where opp.id = opportunity_id
        and opp.status = 'published'
    )
  );

-- UPDATE:
-- 1. Faculty applicant can update their own interest (faculty_id = auth.uid())
-- 2. Opportunity owner can update status of interests submitted to their opportunity
drop policy if exists "faculty_interests_update" on public.faculty_opportunity_interests;
create policy "faculty_interests_update"
  on public.faculty_opportunity_interests
  for update
  to authenticated
  using (
    faculty_id = auth.uid()
    or exists (
      select 1 from public.faculty_opportunities opp
      where opp.id = opportunity_id
        and opp.created_by = auth.uid()
    )
  )
  with check (
    faculty_id = auth.uid()
    or exists (
      select 1 from public.faculty_opportunities opp
      where opp.id = opportunity_id
        and opp.created_by = auth.uid()
    )
  );

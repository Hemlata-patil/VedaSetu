-- Migration: 20260910094257_opportunities.sql
-- Description: Industry opportunities and competency skill matching
-- Module: Opportunities & Skill Matching MVP

-- =============================================================================
-- 1. TABLE: public.opportunities
-- =============================================================================

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  opportunity_type text not null check (opportunity_type in ('internship', 'project', 'apprenticeship', 'entry_level_job')),
  location text,
  work_mode text check (work_mode is null or work_mode in ('onsite', 'hybrid', 'remote')),
  eligibility text,
  application_deadline date,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for status filtering (published opportunities query)
create index if not exists idx_opportunities_status on public.opportunities(status);
create index if not exists idx_opportunities_created_by on public.opportunities(created_by);
create index if not exists idx_opportunities_organization_id on public.opportunities(organization_id);

-- Trigger function for opportunities updated_at
create or replace function public.handle_opportunity_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_opportunities_updated_at on public.opportunities;
create trigger trg_opportunities_updated_at
  before update on public.opportunities
  for each row execute function public.handle_opportunity_updated_at();

-- =============================================================================
-- 2. TABLE: public.opportunity_competencies
-- =============================================================================

create table if not exists public.opportunity_competencies (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  required_score numeric not null default 60 check (required_score between 0 and 100),
  weight numeric not null default 1 check (weight > 0),
  created_at timestamptz not null default now(),
  primary key (opportunity_id, competency_id)
);

-- Index for competency reverse lookup
create index if not exists idx_opportunity_competencies_comp_id on public.opportunity_competencies(competency_id);

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =============================================================================

alter table public.opportunities enable row level security;
alter table public.opportunity_competencies enable row level security;

-- -----------------------------------------------------------------------------
-- 3.1 OPPORTUNITIES POLICIES
-- -----------------------------------------------------------------------------

-- Authenticated users can view published opportunities
create policy "opportunities_select_published"
  on public.opportunities for select
  to authenticated
  using (status = 'published');

-- Industry creators can view all opportunities they created (draft, published, closed, archived)
create policy "opportunities_select_own"
  on public.opportunities for select
  to authenticated
  using (created_by = auth.uid());

-- Industry users can insert opportunities they create
create policy "opportunities_insert_industry"
  on public.opportunities for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'industry'
    )
  );

-- Industry users can update opportunities they own
create policy "opportunities_update_industry"
  on public.opportunities for update
  to authenticated
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'industry'
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'industry'
    )
  );

-- Industry users can delete opportunities they own
create policy "opportunities_delete_industry"
  on public.opportunities for delete
  to authenticated
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'industry'
    )
  );

-- -----------------------------------------------------------------------------
-- 3.2 OPPORTUNITY_COMPETENCIES POLICIES
-- -----------------------------------------------------------------------------

-- Authenticated users can view competency requirements for published opportunities
create policy "opp_comp_select_published"
  on public.opportunity_competencies for select
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_competencies.opportunity_id
      and o.status = 'published'
    )
  );

-- Industry creators can view competency requirements for their own opportunities
create policy "opp_comp_select_own"
  on public.opportunity_competencies for select
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_competencies.opportunity_id
      and o.created_by = auth.uid()
    )
  );

-- Industry creators can attach competency requirements to their own opportunities
create policy "opp_comp_insert_industry"
  on public.opportunity_competencies for insert
  to authenticated
  with check (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_competencies.opportunity_id
      and o.created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'industry'
      )
    )
  );

-- Industry creators can update competency requirements on their own opportunities
create policy "opp_comp_update_industry"
  on public.opportunity_competencies for update
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_competencies.opportunity_id
      and o.created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'industry'
      )
    )
  )
  with check (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_competencies.opportunity_id
      and o.created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'industry'
      )
    )
  );

-- Industry creators can remove competency requirements from their own opportunities
create policy "opp_comp_delete_industry"
  on public.opportunity_competencies for delete
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_competencies.opportunity_id
      and o.created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'industry'
      )
    )
  );

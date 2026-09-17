-- Migration: 20260910140228_digital_portfolio.sql
-- Description: Student Digital Portfolio MVP
-- Module: Student Digital Portfolio & Evidence Management

-- =============================================================================
-- 1. TABLE DEFINITION: public.portfolio_items
-- =============================================================================

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('certification', 'project', 'achievement', 'research', 'publication', 'workshop', 'other')),
  title text not null check (length(trim(title)) > 0),
  description text,
  issuer_or_organization text,
  start_date date,
  end_date date,
  reference_url text,
  achievement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_portfolio_dates check (end_date is null or start_date is null or end_date >= start_date)
);

-- Indexes for performance
create index if not exists idx_portfolio_items_student_id on public.portfolio_items(student_id);
create index if not exists idx_portfolio_items_item_type on public.portfolio_items(item_type);

-- =============================================================================
-- 2. DEDICATED UPDATE TRIGGER
-- =============================================================================

create or replace function public.handle_portfolio_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Protect immutable fields
  if old.id is distinct from new.id then
    raise exception 'Portfolio item ID is immutable.';
  end if;

  if old.student_id is distinct from new.student_id then
    raise exception 'student_id is immutable.';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'created_at is immutable.';
  end if;

  -- Update timestamp
  new.updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_portfolio_items_update on public.portfolio_items;
create trigger trg_portfolio_items_update
  before update on public.portfolio_items
  for each row
  execute function public.handle_portfolio_item_update();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.portfolio_items enable row level security;

-- 3.1 SELECT: Student can only select their own portfolio items
drop policy if exists "portfolio_items_select" on public.portfolio_items;
create policy "portfolio_items_select"
  on public.portfolio_items
  for select
  to authenticated
  using (
    student_id = auth.uid()
  );

-- 3.2 INSERT: Student can only insert portfolio items for themselves
drop policy if exists "portfolio_items_insert" on public.portfolio_items;
create policy "portfolio_items_insert"
  on public.portfolio_items
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
  );

-- 3.3 UPDATE: Student can only update their own portfolio items
drop policy if exists "portfolio_items_update" on public.portfolio_items;
create policy "portfolio_items_update"
  on public.portfolio_items
  for update
  to authenticated
  using (
    student_id = auth.uid()
  )
  with check (
    student_id = auth.uid()
  );

-- 3.4 DELETE: Student can only delete their own portfolio items
drop policy if exists "portfolio_items_delete" on public.portfolio_items;
create policy "portfolio_items_delete"
  on public.portfolio_items
  for delete
  to authenticated
  using (
    student_id = auth.uid()
  );

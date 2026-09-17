-- Migration: 20260910034914_skill_assessment.sql
-- Description: Student Skill Assessment database schema for Ayush Academia-Industry Collaboration Platform
-- Security & Integrity: Strict relational integrity, composite foreign keys, and hardened RLS policies.

-- =============================================================================
-- 1. TABLE DEFINITIONS
-- =============================================================================

-- 1.1 competencies
create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('academic_domain', 'clinical_practical', 'research', 'professional')),
  description text,
  source text,
  source_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 1.2 assessment_templates
create table if not exists public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  program text,
  year integer,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.3 assessment_questions
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_template_id uuid not null references public.assessment_templates(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  question text not null,
  question_type text not null default 'self_rating',
  weight numeric not null default 1 check (weight > 0),
  difficulty text,
  source text,
  source_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_assessment_questions_id_template unique (id, assessment_template_id)
);

-- 1.4 assessment_attempts
create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_template_id uuid not null references public.assessment_templates(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'expired')),
  started_at timestamptz,
  submitted_at timestamptz,
  total_score numeric check (total_score is null or (total_score >= 0 and total_score <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_assessment_attempts_template_student unique (assessment_template_id, student_id),
  constraint uq_assessment_attempts_id_template unique (id, assessment_template_id)
);

-- 1.5 assessment_answers
-- Enforces cross-template question/attempt mismatch prevention via composite foreign keys.
create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  question_id uuid not null,
  assessment_template_id uuid not null,
  answer_value numeric,
  answer_text text,
  created_at timestamptz not null default now(),
  constraint uq_assessment_answers_attempt_question unique (attempt_id, question_id),
  constraint fk_assessment_answers_attempt_template
    foreign key (attempt_id, assessment_template_id)
    references public.assessment_attempts(id, assessment_template_id)
    on delete cascade,
  constraint fk_assessment_answers_question_template
    foreign key (question_id, assessment_template_id)
    references public.assessment_questions(id, assessment_template_id)
    on delete restrict
);

-- 1.6 student_competencies
create table if not exists public.student_competencies (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  proficiency_score numeric check (proficiency_score is null or (proficiency_score >= 0 and proficiency_score <= 100)),
  last_assessed_at timestamptz,
  source text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_student_competencies_student_competency unique (student_id, competency_id)
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

create index if not exists idx_competencies_category on public.competencies(category);
create index if not exists idx_competencies_is_active on public.competencies(is_active);

create index if not exists idx_assessment_templates_created_by on public.assessment_templates(created_by);
create index if not exists idx_assessment_templates_status on public.assessment_templates(status);

create index if not exists idx_assessment_questions_template_id on public.assessment_questions(assessment_template_id);
create index if not exists idx_assessment_questions_competency_id on public.assessment_questions(competency_id);
create index if not exists idx_assessment_questions_is_active on public.assessment_questions(is_active);

create index if not exists idx_assessment_attempts_student_id on public.assessment_attempts(student_id);
create index if not exists idx_assessment_attempts_template_id on public.assessment_attempts(assessment_template_id);
create index if not exists idx_assessment_attempts_status on public.assessment_attempts(status);

create index if not exists idx_assessment_answers_attempt_id on public.assessment_answers(attempt_id);
create index if not exists idx_assessment_answers_question_id on public.assessment_answers(question_id);
create index if not exists idx_assessment_answers_template_id on public.assessment_answers(assessment_template_id);

create index if not exists idx_student_competencies_student_id on public.student_competencies(student_id);
create index if not exists idx_student_competencies_competency_id on public.student_competencies(competency_id);

-- =============================================================================
-- 3. TRIGGERS
-- =============================================================================

-- Dedicated updated_at trigger function for assessment module tables.
-- DO NOT alter or replace public.handle_updated_at() from migration 001.
create or replace function public.set_assessment_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_assessment_templates_updated_at on public.assessment_templates;
create trigger set_assessment_templates_updated_at
  before update on public.assessment_templates
  for each row
  execute function public.set_assessment_updated_at();

drop trigger if exists set_assessment_attempts_updated_at on public.assessment_attempts;
create trigger set_assessment_attempts_updated_at
  before update on public.assessment_attempts
  for each row
  execute function public.set_assessment_updated_at();

drop trigger if exists set_student_competencies_updated_at on public.student_competencies;
create trigger set_student_competencies_updated_at
  before update on public.student_competencies
  for each row
  execute function public.set_assessment_updated_at();

-- Validate new assessment attempts created by authenticated students.
-- Precludes creation of already-finalized, pre-started, or pre-scored attempts.
create or replace function public.handle_assessment_attempt_insert()
returns trigger as $$
begin
  if auth.role() = 'authenticated' then
    if new.status is distinct from 'not_started' then
      raise exception 'Unauthorized: New assessment attempts must have status not_started';
    end if;

    if new.total_score is not null then
      raise exception 'Unauthorized: total_score cannot be populated on creation';
    end if;

    if new.submitted_at is not null then
      raise exception 'Unauthorized: submitted_at cannot be populated on creation';
    end if;

    if new.started_at is not null then
      raise exception 'Unauthorized: started_at cannot be populated on creation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_assessment_attempt_insert on public.assessment_attempts;
create trigger validate_assessment_attempt_insert
  before insert on public.assessment_attempts
  for each row
  execute function public.handle_assessment_attempt_insert();

-- Enforce immutability of student ownership, assessment template association,
-- forward status transitions, and protect server-controlled fields from client tampering.
create or replace function public.handle_assessment_attempt_update()
returns trigger as $$
begin
  -- Apply strict field protection to authenticated client sessions
  if auth.role() = 'authenticated' then
    -- Attempt permanently belongs to the student who created it
    if new.student_id is distinct from old.student_id then
      raise exception 'Unauthorized: student_id cannot be modified';
    end if;

    -- Attempt permanently belongs to the assessment template it was created for
    if new.assessment_template_id is distinct from old.assessment_template_id then
      raise exception 'Unauthorized: assessment_template_id cannot be modified';
    end if;

    -- Status transition enforcement:
    -- Students may only transition from 'not_started' to 'in_progress'.
    -- Moving backward, or transitioning to/from 'submitted' or 'expired', is strictly forbidden.
    if new.status is distinct from old.status then
      if old.status = 'not_started' and new.status = 'in_progress' then
        -- Allowed: starting the attempt
        if new.started_at is null then
          new.started_at = now();
        end if;
      else
        raise exception 'Unauthorized: Invalid attempt status transition from % to %', old.status, new.status;
      end if;
    end if;

    -- Ensure started_at is recorded when in_progress
    if new.status = 'in_progress' and new.started_at is null then
      new.started_at = now();
    end if;

    -- started_at cannot be altered once recorded
    if old.started_at is not null and new.started_at is distinct from old.started_at then
      raise exception 'Unauthorized: started_at cannot be modified once set';
    end if;

    -- Score calculation is reserved for trusted backend logic
    if new.total_score is distinct from old.total_score then
      raise exception 'Unauthorized: total_score cannot be directly modified by student';
    end if;

    -- Submission finalization timestamp is reserved for trusted backend logic
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'Unauthorized: submitted_at cannot be directly modified by student';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists protect_assessment_attempt_fields on public.assessment_attempts;
create trigger protect_assessment_attempt_fields
  before update on public.assessment_attempts
  for each row
  execute function public.handle_assessment_attempt_update();

-- Protect assessment answer identity (attempt_id, question_id, assessment_template_id).
-- Students may only modify answer_value and answer_text.
create or replace function public.handle_assessment_answer_update()
returns trigger as $$
begin
  if auth.role() = 'authenticated' then
    if new.attempt_id is distinct from old.attempt_id then
      raise exception 'Unauthorized: attempt_id cannot be modified';
    end if;

    if new.question_id is distinct from old.question_id then
      raise exception 'Unauthorized: question_id cannot be modified';
    end if;

    if new.assessment_template_id is distinct from old.assessment_template_id then
      raise exception 'Unauthorized: assessment_template_id cannot be modified';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists protect_assessment_answer_fields on public.assessment_answers;
create trigger protect_assessment_answer_fields
  before update on public.assessment_answers
  for each row
  execute function public.handle_assessment_answer_update();

-- Automatically derive assessment_template_id for answers from parent attempt
-- to guarantee referential alignment and satisfy the composite foreign key.
create or replace function public.handle_assessment_answers_template_id()
returns trigger as $$
begin
  select assessment_template_id into new.assessment_template_id
  from public.assessment_attempts
  where id = new.attempt_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists set_assessment_answers_template_id on public.assessment_answers;
create trigger set_assessment_answers_template_id
  before insert on public.assessment_answers
  for each row
  execute function public.handle_assessment_answers_template_id();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================

alter table public.competencies enable row level security;
alter table public.assessment_templates enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.student_competencies enable row level security;

-- -----------------------------------------------------------------------------
-- 4.1 competencies
-- Authenticated users can read active competencies.
-- Writes reserved for trusted admin / future management workflows (no public/student writes).
-- -----------------------------------------------------------------------------
drop policy if exists "competencies_select_active" on public.competencies;
create policy "competencies_select_active"
  on public.competencies
  for select
  to authenticated
  using (is_active = true);

-- -----------------------------------------------------------------------------
-- 4.2 assessment_templates
-- Authenticated users can view published templates.
-- Writes reserved for authorized curriculum managers (no public/student writes).
-- -----------------------------------------------------------------------------
drop policy if exists "assessment_templates_select_published" on public.assessment_templates;
create policy "assessment_templates_select_published"
  on public.assessment_templates
  for select
  to authenticated
  using (status = 'published');

-- -----------------------------------------------------------------------------
-- 4.3 assessment_questions
-- Authenticated users can view active questions of published templates.
-- Writes reserved for authorized curriculum managers (no public/student writes).
-- -----------------------------------------------------------------------------
drop policy if exists "assessment_questions_select_published" on public.assessment_questions;
create policy "assessment_questions_select_published"
  on public.assessment_questions
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.assessment_templates t
      where t.id = assessment_questions.assessment_template_id
        and t.status = 'published'
    )
  );

-- -----------------------------------------------------------------------------
-- 4.4 assessment_attempts
-- Students can read their own attempts.
-- Students can only insert attempts for themselves if role='student' and template is published.
-- Students can only update their own in-progress attempts; scores & submission timestamps
-- cannot be modified via client update policies (handled via trusted server-side workflow).
-- -----------------------------------------------------------------------------
drop policy if exists "assessment_attempts_select_own" on public.assessment_attempts;
create policy "assessment_attempts_select_own"
  on public.assessment_attempts
  for select
  to authenticated
  using (student_id = auth.uid());

drop policy if exists "assessment_attempts_insert_student" on public.assessment_attempts;
create policy "assessment_attempts_insert_student"
  on public.assessment_attempts
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'not_started'
    and total_score is null
    and submitted_at is null
    and started_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
    )
    and exists (
      select 1 from public.assessment_templates t
      where t.id = assessment_attempts.assessment_template_id
        and t.status = 'published'
    )
  );

drop policy if exists "assessment_attempts_update_student" on public.assessment_attempts;
create policy "assessment_attempts_update_student"
  on public.assessment_attempts
  for update
  to authenticated
  using (
    student_id = auth.uid()
    and status in ('not_started', 'in_progress')
  )
  with check (
    student_id = auth.uid()
    and status in ('not_started', 'in_progress')
    and total_score is null
    and submitted_at is null
  );

-- -----------------------------------------------------------------------------
-- 4.5 assessment_answers
-- Students can select, insert, and update answers only for their own in-progress attempts.
-- Insert/update strictly verify:
-- 1. Attempt belongs to auth.uid()
-- 2. Attempt is 'in_progress'
-- 3. Question belongs to the same assessment template as the attempt
-- 4. Question is active
-- Database composite foreign key enforces template consistency at engine level.
-- -----------------------------------------------------------------------------
drop policy if exists "assessment_answers_select_own" on public.assessment_answers;
create policy "assessment_answers_select_own"
  on public.assessment_answers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = assessment_answers.attempt_id
        and a.student_id = auth.uid()
    )
  );

drop policy if exists "assessment_answers_insert_own" on public.assessment_answers;
create policy "assessment_answers_insert_own"
  on public.assessment_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assessment_attempts a
      join public.assessment_questions q
        on q.id = assessment_answers.question_id
        and q.assessment_template_id = a.assessment_template_id
      where a.id = assessment_answers.attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
        and q.is_active = true
    )
  );

drop policy if exists "assessment_answers_update_own" on public.assessment_answers;
create policy "assessment_answers_update_own"
  on public.assessment_answers
  for update
  to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = assessment_answers.attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.assessment_attempts a
      join public.assessment_questions q
        on q.id = assessment_answers.question_id
        and q.assessment_template_id = a.assessment_template_id
      where a.id = assessment_answers.attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
        and q.is_active = true
    )
  );

-- -----------------------------------------------------------------------------
-- 4.6 student_competencies
-- Students can only select their own competency records.
-- No client INSERT, UPDATE, or DELETE policies exist (read-only for students).
-- Proficiency scores can only be updated by trusted server-side assessment logic.
-- -----------------------------------------------------------------------------
drop policy if exists "student_competencies_select_own" on public.student_competencies;
create policy "student_competencies_select_own"
  on public.student_competencies
  for select
  to authenticated
  using (student_id = auth.uid());

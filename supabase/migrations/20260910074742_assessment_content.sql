-- Migration: 20260910074742_assessment_content.sql
-- Description: Assessment content schema (options, max_score, MCQ constraints, and protected question keys)
-- Security: Correct answers stored in separate table with zero client access; students can never view answer keys.

-- =============================================================================
-- 1. UPDATE public.assessment_questions
-- =============================================================================

-- Add options and max_score columns
alter table public.assessment_questions
  add column if not exists options jsonb,
  add column if not exists max_score numeric not null default 1;

-- Validation: max_score > 0
alter table public.assessment_questions
  drop constraint if exists chk_assessment_questions_max_score,
  add constraint chk_assessment_questions_max_score
    check (max_score > 0);

-- Validation: Supported question types (mcq, self_rating)
alter table public.assessment_questions
  drop constraint if exists chk_assessment_questions_type,
  add constraint chk_assessment_questions_type
    check (question_type in ('mcq', 'self_rating'));

-- Validation: MCQ questions must have options defined (options may be null for self_rating)
alter table public.assessment_questions
  drop constraint if exists chk_assessment_questions_mcq_options,
  add constraint chk_assessment_questions_mcq_options
    check (question_type != 'mcq' or options is not null);

-- =============================================================================
-- 2. CREATE public.assessment_question_keys
-- =============================================================================

create table if not exists public.assessment_question_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  correct_answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 3. TRIGGER FOR assessment_question_keys
-- =============================================================================

-- Dedicated updated_at trigger function for assessment content.
-- DO NOT alter or replace public.handle_updated_at() from migration 001.
create or replace function public.set_assessment_content_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_assessment_question_keys_updated_at on public.assessment_question_keys;
create trigger set_assessment_question_keys_updated_at
  before update on public.assessment_question_keys
  for each row
  execute function public.set_assessment_content_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) FOR assessment_question_keys
-- =============================================================================

alter table public.assessment_question_keys enable row level security;

-- NOTE: Strictly NO SELECT, INSERT, UPDATE, or DELETE policies are granted
-- to authenticated or anon roles for assessment_question_keys.
-- This ensures students and unauthorized clients can NEVER read correct answers.
-- Scoring is executed exclusively by trusted backend / service-role workflows.

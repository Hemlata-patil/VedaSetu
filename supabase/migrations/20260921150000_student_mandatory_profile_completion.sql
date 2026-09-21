-- Migration: 20260921150000_student_mandatory_profile_completion.sql
-- Description: Mandatory Profile Completion schema additions for Student users in Veda Setu
-- Note: Non-destructive schema extension only. Zero seed data inserted.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS semester text,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS career_interests text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

-- Performance index for fast profile completion status checks scoped to role
CREATE INDEX IF NOT EXISTS idx_profiles_student_completion
  ON public.profiles(role, profile_completed);

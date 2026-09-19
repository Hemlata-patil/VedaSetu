-- =============================================================================
-- Migration: Allow Assessment Reattempts & Longitudinal Progress Tracking
-- Description: Drops the single-attempt unique constraint on (assessment_template_id, student_id)
-- to allow students to take multiple attempts (reassessments) over time while preserving all
-- previous attempts and scores.
-- =============================================================================

alter table public.assessment_attempts
  drop constraint if exists uq_assessment_attempts_template_student;

-- =============================================================================
-- VEDA SETU: NAMASTE E-LOGBOOK FINAL PROPOSAL (PHASE 5)
-- File: supabase/migrations/drafts/20260919_phase5_elogbook_final_proposal.sql
-- Status: PROPOSAL DRAFT ONLY — DO NOT EXECUTE OR APPLY WITHOUT EXPLICIT APPROVAL
-- Security Model: Tiered Faculty Supervision, Whitelisted Mutations, and Privacy Isolation
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ARCHITECTURAL DESIGN SUMMARY:
-- 1. Identity & Perimeters:
--    - Uses public.profiles (role, institution_id, department) and public.institutions.
--    - Reuses public.competencies (13 NCISM standards) without creating duplicate tables.
--    - Leverages public.mentorships for supervisory relationship mapping.
--
-- 2. Faculty Access Model (Tiered Composite Supervision):
--    - A faculty member can read submitted cases if they belong to the same institution AND
--      (a) share the same clinical department, OR
--      (b) have an active mentorship with the student, OR
--      (c) are explicitly assigned as the case reviewer (faculty_id = auth.uid()).
--    - Claim & Lock: Any authorized faculty can transition 'submitted' -> 'under_review'.
--      Once claimed, only the assigned faculty (faculty_id = auth.uid()) can verify or
--      request revisions, preventing concurrent reviewer collisions.
--
-- 3. Patient Privacy & De-identification:
--    - Strict synthetic reference tokens (case_reference_token e.g. 'CASE-2026-KC-01').
--    - Broad patient age groups (patient_age_group e.g. 'Middle Adult (36-55 yrs)').
--    - Real hospital OPD/CR numbers, MRNs, ABHA IDs, and patient names are prohibited.
--
-- 4. Institutional & Industry Isolation:
--    - Base tables have ZERO select/insert/update/delete policies for institution & industry.
--    - Institutional compliance metrics provided exclusively via get_institution_elogbook_stats().
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1. TABLE DEFINITIONS
-- =============================================================================

-- 1.1 Primary Clinical Case Log Table
create table if not exists public.clinical_case_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  faculty_id uuid references public.profiles(id) on delete set null,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  
  -- Patient Privacy & De-identification
  case_reference_token text not null check (length(trim(case_reference_token)) > 0),
  patient_age integer check (patient_age is null or (patient_age >= 0 and patient_age <= 125)),
  patient_age_group text,
  patient_gender text check (patient_gender is null or patient_gender in ('male', 'female', 'other')),
  
  -- Clinical Context & Ayurveda Speciality
  department text not null check (
    department in (
      'Kayachikitsa',
      'Shalya Tantra',
      'Shalakya Tantra',
      'Prasuti & Stri Roga',
      'Kaumarbhritya',
      'Panchakarma',
      'Swasthavritta',
      'Agada Tantra',
      'Other'
    )
  ),
  encounter_date date not null default current_date,
  
  -- Clinical Observations & Rogi Pariksha Findings
  chief_complaint text not null check (length(trim(chief_complaint)) > 0),
  clinical_history text,
  prakriti_assessment text,
  examination_findings text,
  provisional_diagnosis text not null check (length(trim(provisional_diagnosis)) > 0),
  
  -- Standardized Terminology References (Phase 1 Catalog Integration)
  namaste_code text,
  namaste_term text,
  icd11_tm2_code text,
  
  -- Treatment Regimen & Student Learning Reflections
  treatment_plan text not null check (length(trim(treatment_plan)) > 0),
  learning_reflections text,
  
  -- Review Lifecycle & Faculty Supervision
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'under_review', 'verified', 'revision_requested')
  ),
  faculty_feedback text,
  submitted_at timestamptz,
  verified_at timestamptz,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for Query Performance & RLS Scoping
create index if not exists idx_case_logs_student_id on public.clinical_case_logs(student_id);
create index if not exists idx_case_logs_faculty_id on public.clinical_case_logs(faculty_id);
create index if not exists idx_case_logs_institution_id on public.clinical_case_logs(institution_id);
create index if not exists idx_case_logs_status on public.clinical_case_logs(status);
create index if not exists idx_case_logs_department on public.clinical_case_logs(department);
create index if not exists idx_case_logs_encounter_date on public.clinical_case_logs(encounter_date);

-- 1.2 Junction Table: Case Competencies (NCISM Learning Evidence)
create table if not exists public.clinical_case_competencies (
  case_log_id uuid not null references public.clinical_case_logs(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (case_log_id, competency_id)
);

create index if not exists idx_case_competencies_comp_id on public.clinical_case_competencies(competency_id);

-- 1.3 Case Attachments Metadata (De-identified Supporting Documents)
create table if not exists public.clinical_case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_log_id uuid not null references public.clinical_case_logs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_type text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880), -- Max 5 MB
  created_at timestamptz not null default now()
);

create index if not exists idx_case_attachments_case_log on public.clinical_case_attachments(case_log_id);
create index if not exists idx_case_attachments_student on public.clinical_case_attachments(student_id);

-- =============================================================================
-- 2. HELPER FUNCTIONS & AUTHORIZATION DEFINITIONS
-- =============================================================================

-- 2.1 Helper to check if authenticated faculty is authorized to review a specific case
create or replace function public.is_faculty_authorized_for_case(p_case_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_faculty_inst_id uuid;
  v_faculty_dept text;
  v_case_inst_id uuid;
  v_case_dept text;
  v_case_student_id uuid;
  v_case_faculty_id uuid;
  v_case_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  -- Fetch faculty profile context
  select institution_id, department into v_faculty_inst_id, v_faculty_dept
  from public.profiles
  where id = v_uid and role = 'faculty';

  if v_faculty_inst_id is null then
    return false;
  end if;

  -- Fetch case record context
  select institution_id, department, student_id, faculty_id, status
  into v_case_inst_id, v_case_dept, v_case_student_id, v_case_faculty_id, v_case_status
  from public.clinical_case_logs
  where id = p_case_id;

  if v_case_inst_id is null or v_case_inst_id is distinct from v_faculty_inst_id then
    return false;
  end if;

  -- Draft cases are never visible to faculty
  if v_case_status = 'draft' then
    return false;
  end if;

  -- Check 1: Explicitly assigned reviewer
  if v_case_faculty_id is not null and v_case_faculty_id = v_uid then
    return true;
  end if;

  -- Check 2: Matching clinical department
  if v_faculty_dept is not null and v_case_dept = v_faculty_dept then
    return true;
  end if;

  -- Check 3: Active faculty mentor in public.mentorships
  if exists (
    select 1 from public.mentorships m
    where m.faculty_id = v_uid
      and m.student_id = v_case_student_id
      and m.status = 'active'
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.is_faculty_authorized_for_case(uuid) from public;
grant execute on function public.is_faculty_authorized_for_case(uuid) to authenticated;

-- =============================================================================
-- 3. INTEGRITY & ANTI-TAMPERING TRIGGERS
-- =============================================================================

-- 3.1 Updated-at Timestamp Trigger
create or replace function public.set_case_log_updated_at()
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

drop trigger if exists trg_case_logs_updated_at on public.clinical_case_logs;
create trigger trg_case_logs_updated_at
  before update on public.clinical_case_logs
  for each row
  execute function public.set_case_log_updated_at();

-- 3.2 Insertion Validation & Anti-Spoofing Trigger
create or replace function public.validate_case_log_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block creation in review or terminal states
  if new.status in ('under_review', 'verified', 'revision_requested') then
    raise exception 'New clinical case logs must be initiated in draft or submitted status.';
  end if;

  -- Block client forgery of verification timestamps or faculty remarks on insert
  if new.verified_at is not null then
    raise exception 'Unauthorized: verified_at cannot be populated on case creation.';
  end if;

  if new.faculty_feedback is not null then
    raise exception 'Unauthorized: faculty_feedback cannot be populated on case creation.';
  end if;

  -- Ensure submitted_at timestamp is accurately stamped if created directly as submitted
  if new.status = 'submitted' then
    new.submitted_at := coalesce(new.submitted_at, now());
  else
    new.submitted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_case_log_insert on public.clinical_case_logs;
create trigger trg_validate_case_log_insert
  before insert on public.clinical_case_logs
  for each row
  execute function public.validate_case_log_insert();

-- 3.3 State Machine & Whitelisted Mutation Trigger
create or replace function public.validate_case_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_role text;
  v_faculty_inst_id uuid;
begin
  v_uid := auth.uid();
  
  -- 1. Protect core immutable identifiers across all callers
  if old.id is distinct from new.id then
    raise exception 'Case log ID is immutable.';
  end if;

  if old.student_id is distinct from new.student_id then
    raise exception 'student_id is immutable.';
  end if;

  if old.institution_id is distinct from new.institution_id then
    raise exception 'institution_id is immutable.';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'created_at is immutable.';
  end if;

  -- 2. Terminal State Lock: Verified cases are permanently sealed and immutable
  if old.status = 'verified' then
    raise exception 'Verified clinical case logs are permanently sealed and immutable.';
  end if;

  -- Fetch caller role if authenticated session
  if v_uid is not null then
    select role, institution_id into v_role, v_faculty_inst_id
    from public.profiles
    where id = v_uid;

    -- =========================================================================
    -- A. STUDENT MUTATION RULES
    -- =========================================================================
    if v_role = 'student' and v_uid = old.student_id then
      -- Security: Students can NEVER self-verify or set verified_at
      if new.status = 'verified' then
        raise exception 'Unauthorized: Students cannot verify their own case logs.';
      end if;

      if new.verified_at is not null and old.verified_at is null then
        raise exception 'Unauthorized: verified_at timestamp cannot be set by students.';
      end if;

      -- Students cannot modify faculty feedback
      if new.faculty_feedback is distinct from old.faculty_feedback then
        raise exception 'Unauthorized: Students cannot modify faculty feedback.';
      end if;

      -- State transitions for students:
      -- Allowed transitions: draft -> submitted, revision_requested -> submitted, draft -> draft, revision_requested -> revision_requested
      if old.status is distinct from new.status then
        if old.status = 'draft' and new.status = 'submitted' then
          new.submitted_at := now();
        elsif old.status = 'revision_requested' and new.status = 'submitted' then
          new.submitted_at := now();
        else
          raise exception 'Invalid status transition for student from % to %.', old.status, new.status;
        end if;
      end if;

      -- If case is already submitted or under review, student cannot edit clinical fields
      if old.status in ('submitted', 'under_review') and new.status = old.status then
        raise exception 'Submitted case logs are under review and cannot be edited. Await faculty feedback.';
      end if;

    -- =========================================================================
    -- B. FACULTY MUTATION RULES (STRICT WHITELIST ENFORCEMENT)
    -- =========================================================================
    elsif v_role = 'faculty' then
      -- Verify faculty belongs to the student's institution
      if v_faculty_inst_id is null or v_faculty_inst_id is distinct from old.institution_id then
        raise exception 'Unauthorized: Faculty can only review cases from their own institution.';
      end if;

      -- Faculty cannot update a case that is actively returned for student revision
      if old.status = 'revision_requested' then
        raise exception 'Case is pending student revision and cannot be reviewed until resubmitted.';
      end if;

      -- Concurrency Lock: If already claimed under_review by Faculty A, Faculty B cannot overwrite
      if old.status = 'under_review' and old.faculty_id is not null and old.faculty_id is distinct from v_uid then
        raise exception 'Case is currently under review by another designated faculty supervisor.';
      end if;

      -- STRICT WHITELIST: Assert that ALL student-authored fields remain identical to OLD
      if new.case_reference_token is distinct from old.case_reference_token or
         new.patient_age is distinct from old.patient_age or
         new.patient_age_group is distinct from old.patient_age_group or
         new.patient_gender is distinct from old.patient_gender or
         new.department is distinct from old.department or
         new.encounter_date is distinct from old.encounter_date or
         new.chief_complaint is distinct from old.chief_complaint or
         new.clinical_history is distinct from old.clinical_history or
         new.prakriti_assessment is distinct from old.prakriti_assessment or
         new.examination_findings is distinct from old.examination_findings or
         new.provisional_diagnosis is distinct from old.provisional_diagnosis or
         new.namaste_code is distinct from old.namaste_code or
         new.namaste_term is distinct from old.namaste_term or
         new.icd11_tm2_code is distinct from old.icd11_tm2_code or
         new.treatment_plan is distinct from old.treatment_plan or
         new.learning_reflections is distinct from old.learning_reflections or
         new.submitted_at is distinct from old.submitted_at then
        raise exception 'Unauthorized: Faculty reviewers cannot alter student clinical data, reflections, or timestamps.';
      end if;

      -- Permitted Faculty state transitions:
      -- submitted -> under_review
      -- submitted / under_review -> verified
      -- submitted / under_review -> revision_requested
      if old.status is distinct from new.status then
        if old.status in ('submitted', 'under_review') and new.status = 'verified' then
          new.faculty_id := v_uid;
          new.verified_at := now();
        elsif old.status in ('submitted', 'under_review') and new.status = 'revision_requested' then
          new.faculty_id := v_uid;
          if new.faculty_feedback is null or length(trim(new.faculty_feedback)) = 0 then
            raise exception 'Faculty feedback remarks are required when requesting case revisions.';
          end if;
        elsif old.status = 'submitted' and new.status = 'under_review' then
          new.faculty_id := v_uid;
        else
          raise exception 'Invalid status transition by faculty from % to %.', old.status, new.status;
        end if;
      end if;

    -- =========================================================================
    -- C. OTHER ROLES (INSTITUTION & INDUSTRY)
    -- =========================================================================
    elsif v_role in ('institution', 'industry') then
      raise exception 'Institution and industry roles do not have permission to modify clinical case logs.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_case_log_mutation on public.clinical_case_logs;
create trigger trg_validate_case_log_mutation
  before update on public.clinical_case_logs
  for each row
  execute function public.validate_case_log_mutation();

-- 3.4 Attachment Ownership & Immutability Trigger
create or replace function public.validate_case_attachment_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_student_id uuid;
begin
  select student_id into v_case_student_id
  from public.clinical_case_logs
  where id = new.case_log_id;

  if v_case_student_id is null then
    raise exception 'Referenced clinical case log does not exist.';
  end if;

  if v_case_student_id != new.student_id then
    raise exception 'Attachment student_id does not match case log student_id.';
  end if;

  if tg_op = 'UPDATE' then
    if old.id is distinct from new.id or
       old.case_log_id is distinct from new.case_log_id or
       old.student_id is distinct from new.student_id or
       old.storage_path is distinct from new.storage_path then
      raise exception 'Attachment metadata is immutable once recorded.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_case_attachment_ownership on public.clinical_case_attachments;
create trigger trg_validate_case_attachment_ownership
  before insert or update on public.clinical_case_attachments
  for each row
  execute function public.validate_case_attachment_ownership();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.clinical_case_logs enable row level security;
alter table public.clinical_case_competencies enable row level security;
alter table public.clinical_case_attachments enable row level security;

-- -----------------------------------------------------------------------------
-- 4.1 public.clinical_case_logs RLS Policies
-- -----------------------------------------------------------------------------

-- Student SELECT: Students can view all their own cases
drop policy if exists "case_logs_student_select" on public.clinical_case_logs;
create policy "case_logs_student_select"
  on public.clinical_case_logs for select
  to authenticated
  using (student_id = auth.uid());

-- Student INSERT: Students can insert draft or submitted cases for themselves
drop policy if exists "case_logs_student_insert" on public.clinical_case_logs;
create policy "case_logs_student_insert"
  on public.clinical_case_logs for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status in ('draft', 'submitted')
    and verified_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.institution_id is not null
        and p.institution_id = clinical_case_logs.institution_id
    )
  );

-- Student UPDATE: Students can update only draft or revision_requested records
drop policy if exists "case_logs_student_update" on public.clinical_case_logs;
create policy "case_logs_student_update"
  on public.clinical_case_logs for update
  to authenticated
  using (
    student_id = auth.uid()
    and status in ('draft', 'revision_requested')
  )
  with check (
    student_id = auth.uid()
    and status in ('draft', 'submitted', 'revision_requested')
  );

-- Student DELETE: Students can delete only draft cases
drop policy if exists "case_logs_student_delete" on public.clinical_case_logs;
create policy "case_logs_student_delete"
  on public.clinical_case_logs for delete
  to authenticated
  using (
    student_id = auth.uid()
    and status = 'draft'
  );

-- Faculty SELECT: Faculty can read non-draft cases within their authorized supervisory scope
drop policy if exists "case_logs_faculty_select" on public.clinical_case_logs;
create policy "case_logs_faculty_select"
  on public.clinical_case_logs for select
  to authenticated
  using (
    institution_id is not null
    and status in ('submitted', 'under_review', 'verified', 'revision_requested')
    and public.is_faculty_authorized_for_case(id)
  );

-- Faculty UPDATE: Faculty can review/verify cases in submitted or under_review states
drop policy if exists "case_logs_faculty_update" on public.clinical_case_logs;
create policy "case_logs_faculty_update"
  on public.clinical_case_logs for update
  to authenticated
  using (
    institution_id is not null
    and status in ('submitted', 'under_review')
    and public.is_faculty_authorized_for_case(id)
  )
  with check (
    institution_id is not null
    and status in ('under_review', 'verified', 'revision_requested')
  );

-- Super Admin SELECT: Super admin read-only access for platform oversight
drop policy if exists "case_logs_super_admin_select" on public.clinical_case_logs;
create policy "case_logs_super_admin_select"
  on public.clinical_case_logs for select
  to authenticated
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 4.2 public.clinical_case_competencies RLS Policies
-- -----------------------------------------------------------------------------

-- SELECT: Accessible if parent case is accessible
drop policy if exists "case_comps_select" on public.clinical_case_competencies;
create policy "case_comps_select"
  on public.clinical_case_competencies for select
  to authenticated
  using (
    exists (
      select 1 from public.clinical_case_logs c
      where c.id = clinical_case_competencies.case_log_id
        and (
          c.student_id = auth.uid()
          or (
            c.status in ('submitted', 'under_review', 'verified', 'revision_requested')
            and public.is_faculty_authorized_for_case(c.id)
          )
          or public.is_super_admin()
        )
    )
  );

-- INSERT / DELETE: Students can manage competency tags on their draft/revision cases
drop policy if exists "case_comps_student_manage" on public.clinical_case_competencies;
create policy "case_comps_student_manage"
  on public.clinical_case_competencies for all
  to authenticated
  using (
    exists (
      select 1 from public.clinical_case_logs c
      where c.id = clinical_case_competencies.case_log_id
        and c.student_id = auth.uid()
        and c.status in ('draft', 'revision_requested')
    )
  )
  with check (
    exists (
      select 1 from public.clinical_case_logs c
      where c.id = clinical_case_competencies.case_log_id
        and c.student_id = auth.uid()
        and c.status in ('draft', 'revision_requested')
    )
  );

-- -----------------------------------------------------------------------------
-- 4.3 public.clinical_case_attachments RLS Policies
-- -----------------------------------------------------------------------------

-- SELECT: Author student, authorized supervising faculty, and super admin
drop policy if exists "case_attachments_select" on public.clinical_case_attachments;
create policy "case_attachments_select"
  on public.clinical_case_attachments for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.clinical_case_logs c
      where c.id = clinical_case_attachments.case_log_id
        and c.status in ('submitted', 'under_review', 'verified', 'revision_requested')
        and public.is_faculty_authorized_for_case(c.id)
    )
    or public.is_super_admin()
  );

-- INSERT: Student can insert attachments on their draft/revision cases
drop policy if exists "case_attachments_insert_student" on public.clinical_case_attachments;
create policy "case_attachments_insert_student"
  on public.clinical_case_attachments for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.clinical_case_logs c
      where c.id = clinical_case_attachments.case_log_id
        and c.student_id = auth.uid()
        and c.status in ('draft', 'revision_requested')
    )
  );

-- DELETE: Student can delete attachments from draft cases
drop policy if exists "case_attachments_delete_student" on public.clinical_case_attachments;
create policy "case_attachments_delete_student"
  on public.clinical_case_attachments for delete
  to authenticated
  using (
    student_id = auth.uid()
    and exists (
      select 1 from public.clinical_case_logs c
      where c.id = clinical_case_attachments.case_log_id
        and c.student_id = auth.uid()
        and c.status = 'draft'
    )
  );

-- =============================================================================
-- 5. PRIVACY-PRESERVING INSTITUTIONAL COMPLIANCE AGGREGATION RPC
-- Purpose: Provides aggregate counts to college administrators without exposing
-- clinical narratives or attachments.
-- =============================================================================

create or replace function public.get_institution_elogbook_stats(target_student_id uuid default null)
returns table (
  total_cases bigint,
  draft_count bigint,
  submitted_count bigint,
  under_review_count bigint,
  verified_count bigint,
  revision_requested_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_inst_id uuid;
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;

  select role, institution_id into v_role, v_inst_id
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'institution' or v_inst_id is null then
    return;
  end if;

  if target_student_id is not null then
    -- Verify target student belongs to caller's institution
    if not public.is_student_in_auth_institution(target_student_id) then
      return;
    end if;

    return query
    select
      count(*)::bigint as total_cases,
      count(*) filter (where c.status = 'draft')::bigint as draft_count,
      count(*) filter (where c.status = 'submitted')::bigint as submitted_count,
      count(*) filter (where c.status = 'under_review')::bigint as under_review_count,
      count(*) filter (where c.status = 'verified')::bigint as verified_count,
      count(*) filter (where c.status = 'revision_requested')::bigint as revision_requested_count
    from public.clinical_case_logs c
    where c.student_id = target_student_id
      and c.institution_id = v_inst_id;
  else
    -- Institution-wide aggregation
    return query
    select
      count(*)::bigint as total_cases,
      count(*) filter (where c.status = 'draft')::bigint as draft_count,
      count(*) filter (where c.status = 'submitted')::bigint as submitted_count,
      count(*) filter (where c.status = 'under_review')::bigint as under_review_count,
      count(*) filter (where c.status = 'verified')::bigint as verified_count,
      count(*) filter (where c.status = 'revision_requested')::bigint as revision_requested_count
    from public.clinical_case_logs c
    where c.institution_id = v_inst_id;
  end if;
end;
$$;

revoke execute on function public.get_institution_elogbook_stats(uuid) from public;
grant execute on function public.get_institution_elogbook_stats(uuid) to authenticated;

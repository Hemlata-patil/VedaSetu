# Veda Setu NAMASTE e-Logbook: Schema & Security Review (Phase 5)

> **Document Status**: **FINAL IMPLEMENTATION PROPOSAL**  
> **Database Status**: **100% UNTOUCHED (Zero live migrations executed)**  
> **Target Draft SQL**: [`supabase/migrations/drafts/20260919_phase5_elogbook_final_proposal.sql`](file:///c:/Users/Yogeshree%20Patil/Documents/hema%20extra/VedaSetu/supabase/migrations/drafts/20260919_phase5_elogbook_final_proposal.sql)

---

## 1. Executive Summary

Phase 5 finalizes the database schema, relational integrity, anti-tampering triggers, and role-based security policies for the Veda Setu clinical e-Logbook. This specification addresses the faculty supervision scope, eliminates cross-department or unauthorized faculty exposure, enforces strict whitelisting on faculty reviews, and guarantees patient privacy through synthetic de-identified tokens.

---

## 2. Proposed Tables & Relational Schema

```
                      ┌────────────────────────┐
                      │  public.institutions   │
                      └───────────▲────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
┌────────┴─────────────┐                         ┌─────────┴────────────┐
│   public.profiles    │                         │   public.profiles    │
│  (role = 'student')  │                         │  (role = 'faculty')  │
└────────▲─────────────┘                         └─────────▲────────────┘
         │ (student_id)                                    │ (faculty_id)
         │                                                 │
         │         ┌──────────────────────────────┐        │
         └─────────┤  public.clinical_case_logs   ├────────┘
                   └──────┬────────────────┬──────┘
                          │                │
           1 : N (cascade)│                │ 1 : N (cascade)
                          ▼                ▼
┌───────────────────────────┐    ┌──────────────────────────────────┐
│ clinical_case_attachments │    │    clinical_case_competencies    │
└───────────────────────────┘    └────────────────┬─────────────────┘
                                                  │ N : 1
                                                  ▼
                                 ┌──────────────────────────────────┐
                                 │       public.competencies        │
                                 │   (Existing 13 NCISM Records)    │
                                 └──────────────────────────────────┘
```

### Table 1: `public.clinical_case_logs`
Primary clinical encounter and learning record authored by Ayush scholars:
- `id` (`uuid`, PK, default `gen_random_uuid()`)
- `student_id` (`uuid`, FK `profiles.id` on delete cascade)
- `faculty_id` (`uuid`, FK `profiles.id` on delete set null)
- `institution_id` (`uuid`, FK `institutions.id` on delete restrict)
- `case_reference_token` (`text`, Not Null) — De-identified synthetic token (e.g. `CASE-2026-KC-01`)
- `patient_age` (`integer`, 0-125) / `patient_age_group` (`text`, e.g. `Middle Adult (36-55 yrs)`)
- `patient_gender` (`text`, `male`, `female`, `other`)
- `department` (`text`, 8 classical Ayurveda branches: *Kayachikitsa, Shalya, Shalakya, Prasuti & Stri Roga, Kaumarbhritya, Panchakarma, Swasthavritta, Agada Tantra, Other*)
- `encounter_date` (`date`, default `current_date`)
- `chief_complaint` (`text`, Not Null) — *Pradhāna Vedanā*
- `clinical_history` (`text`) — *Hetu / Purvaroopa / Chronicity*
- `prakriti_assessment` (`text`) — Dosha Prakriti & Vikriti
- `examination_findings` (`text`) — Ashtavidha Pariksha findings
- `provisional_diagnosis` (`text`, Not Null) — *Roga Vinishchaya*
- `namaste_code` (`text`) / `namaste_term` (`text`) / `icd11_tm2_code` (`text`)
- `treatment_plan` (`text`, Not Null) — *Chikitsā Kram (Shamana / Shodhana)*
- `learning_reflections` (`text`) — Student insights
- `status` (`text`, default `'draft'`, Check: `draft`, `submitted`, `under_review`, `verified`, `revision_requested`)
- `faculty_feedback` (`text`) — Review remarks
- `submitted_at` (`timestamptz`) / `verified_at` (`timestamptz`)
- `created_at` / `updated_at` (`timestamptz`, default `now()`)

### Table 2: `public.clinical_case_competencies`
Junction table linking case encounters to NCISM competencies as learning evidence:
- `case_log_id` (`uuid`, FK `clinical_case_logs.id` on delete cascade)
- `competency_id` (`uuid`, FK `competencies.id` on delete restrict)
- `created_at` (`timestamptz`, default `now()`)
- Primary Key: `(case_log_id, competency_id)`

### Table 3: `public.clinical_case_attachments`
Metadata for de-identified supporting case documents (prescriptions, charts, investigation sheets):
- `id` (`uuid`, PK)
- `case_log_id` (`uuid`, FK `clinical_case_logs.id` on delete cascade)
- `student_id` (`uuid`, FK `profiles.id` on delete cascade)
- `storage_path` (`text`, unique)
- `file_name` (`text`), `file_type` (`text`, pdf/jpeg/png), `file_size` (`bigint`, max 5 MB)
- `created_at` (`timestamptz`, default `now()`)

---

## 3. Faculty Access Design: Tiered Composite Model

### The Problem:
In academic teaching hospitals, not every faculty member should access every student's cases. Broad institutional access allows faculty in unrelated departments (e.g., Agada Tantra) to read private case notes from other departments (e.g., Prasuti Tantra).

### The Solution: `public.is_faculty_authorized_for_case(p_case_id)`
A faculty member is authorized to review a case if and only if:
1. **Institutional Perimeter**: Faculty belongs to the exact same `institution_id` as the student, **AND**
2. **Supervisory Scope** (matches at least one):
   - **Assigned Reviewer**: `c.faculty_id = auth.uid()`, **OR**
   - **Departmental Match**: `c.department = faculty.department` (e.g. Kayachikitsa faculty supervising Kayachikitsa postings), **OR**
   - **Active Mentorship**: Faculty is an active mentor of the student in `public.mentorships` (`status = 'active'`).
3. **Status Isolation**: Case is non-draft (`status in ('submitted', 'under_review', 'verified', 'revision_requested')`).

### Concurrency Lock on Claim:
When a case is in `submitted` status, any authorized faculty in scope can claim it by setting `status = 'under_review'` (which records `new.faculty_id := auth.uid()`).  
Once claimed (`under_review`), **only the assigned faculty (`faculty_id = auth.uid()`)** can complete the sign-off (`verified`) or request revisions (`revision_requested`), preventing reviewer collision.

---

## 4. RLS Policy Matrix

| Role | Operation | Policy Rule | Enforced Boundary |
| :--- | :--- | :--- | :--- |
| **Student** | `SELECT` | `student_id = auth.uid()` | Own case logs only |
| **Student** | `INSERT` | `student_id = auth.uid() AND status in ('draft', 'submitted') AND verified_at IS NULL` | Own cases only; cannot forge verification |
| **Student** | `UPDATE` | `student_id = auth.uid() AND status in ('draft', 'revision_requested')` | Locked from editing while submitted or verified |
| **Student** | `DELETE` | `student_id = auth.uid() AND status = 'draft'` | Only un-submitted drafts can be deleted |
| **Faculty** | `SELECT` | `institution_id = get_auth_faculty_institution_id() AND status != 'draft' AND is_faculty_authorized_for_case(id)` | Authorized departmental / mentored scope only |
| **Faculty** | `UPDATE` | `institution_id = get_auth_faculty_institution_id() AND status in ('submitted', 'under_review') AND is_faculty_authorized_for_case(id)` | Can claim and review in-scope cases |
| **Faculty** | `INSERT` / `DELETE`| **BLOCKED (Default Deny)** | Faculty cannot author or delete student logs |
| **Institution**| Base Tables | **BLOCKED (Default Deny)** | Protects clinical narratives from bulk viewing |
| **Institution**| Analytics RPC| `get_institution_elogbook_stats()` | Aggregate compliance metrics only |
| **Industry** | All | **BLOCKED (Default Deny)** | Zero access to clinical case logs |
| **Super Admin**| `SELECT` | `is_super_admin()` | Read-only platform audit oversight |

---

## 5. Required Triggers & Anti-Tampering Constraints

1. **`validate_case_log_insert()` (BEFORE INSERT)**:
   - Forbids client creation in `under_review`, `verified`, or `revision_requested` states.
   - Forbids client forgery of `verified_at` and `faculty_feedback`.
   - Auto-stamps `submitted_at := now()` if created directly in `submitted` status.
2. **`validate_case_log_mutation()` (BEFORE UPDATE)**:
   - **Immutable Primary Identifiers**: `id`, `student_id`, `institution_id`, `created_at` cannot be changed.
   - **Permanent Verification Seal**: Once `status = 'verified'`, the case is 100% immutable to students, faculty, and administrators.
   - **Student Protection**: Explicitly blocks `new.status = 'verified'` or `new.verified_at IS NOT NULL` if author is student.
   - **Faculty Strict Whitelist**: Explicitly asserts that all student-authored clinical fields (`chief_complaint`, `clinical_history`, `prakriti_assessment`, `examination_findings`, `provisional_diagnosis`, `namaste_code`, `namaste_term`, `icd11_tm2_code`, `treatment_plan`, `learning_reflections`, `case_reference_token`, `patient_age`, `patient_age_group`, `patient_gender`, `department`, `encounter_date`, `submitted_at`) remain identical to `OLD`. Faculty can **only** mutate `status`, `faculty_id`, `faculty_feedback`, `verified_at`, and `updated_at`.
3. **`validate_case_attachment_ownership()` (BEFORE INSERT/UPDATE)**:
   - Enforces that `attachment.student_id` matches parent `case_log.student_id`.
   - Makes attachment metadata immutable once written.

---

## 6. Differences Between Phase 2 Draft & Phase 5 Final Proposal

| Dimension | Phase 2 Draft | Phase 5 Final Proposal | Rationale for Improvement |
| :--- | :--- | :--- | :--- |
| **Faculty Scope** | Institution-wide pool | **Tiered Composite** (Institution + Department Matching OR Active Mentorship) | Prevents cross-department leakage (e.g. Agada Tantra faculty viewing Prasuti Tantra cases). |
| **Concurrency Locking** | None (Any faculty could override) | **Claim & Lock** (Once `under_review`, only assigned `faculty_id` can verify) | Prevents conflicting evaluations between concurrent reviewers. |
| **Faculty Authorization** | Inline RLS checks | Dedicated helper `is_faculty_authorized_for_case()` | Clean, reusable across `clinical_case_logs`, `competencies`, and `attachments`. |
| **Age De-identification** | `patient_age integer` only | `patient_age integer` + `patient_age_group text` | Harmonizes schema with Phase 3 UI categories (e.g. `Middle Adult (36-55 yrs)`). |
| **Insertion Validation** | `BEFORE UPDATE` only | `BEFORE INSERT` + `BEFORE UPDATE` | Eliminates null `submitted_at` edge case on direct submissions. |

---

## 7. Pre-Deployment Validation Checklist

Before applying this migration in a future live database phase:

- [ ] Confirm that `public.competencies` is populated with the 13 NCISM standards.
- [ ] Confirm that faculty profiles have accurate `department` values populated in `public.profiles`.
- [ ] Create the private Supabase Storage bucket `clinical-case-attachments` with max file size `5 MB`.
- [ ] Ensure that service-role keys are strictly kept server-side in Server Actions.
- [ ] Review institutional policy on whether inter-departmental case review is ever required for multi-speciality rotations.

---

*This document represents the finalized technical specification ready for future implementation.*

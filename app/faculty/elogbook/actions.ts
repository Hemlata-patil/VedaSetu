"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ClinicalCaseLog, ClinicalCaseStatus } from "@/lib/elogbook/types";

export interface FacultyActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch all clinical case logs pending review in the faculty member's institutional / departmental scope.
 */
export async function fetchFacultyReviewQueueAction(): Promise<FacultyActionResult<ClinicalCaseLog[]>> {
  try {
    const { user, profile } = await requireRole("faculty");
    const supabase = await createClient();

    if (!profile.institution_id) {
      return { success: false, error: "Faculty profile is not linked to an institution." };
    }

    // Query non-draft cases under faculty's supervisory scope (filtered via RLS is_faculty_authorized_for_case)
    const { data: casesData, error: casesError } = await supabase
      .from("clinical_case_logs")
      .select(`
        id,
        student_id,
        faculty_id,
        institution_id,
        case_reference_token,
        patient_age,
        patient_age_group,
        patient_gender,
        department,
        encounter_date,
        chief_complaint,
        clinical_history,
        prakriti_assessment,
        examination_findings,
        provisional_diagnosis,
        namaste_code,
        namaste_term,
        icd11_tm2_code,
        treatment_plan,
        learning_reflections,
        status,
        faculty_feedback,
        submitted_at,
        verified_at,
        created_at,
        updated_at,
        student:student_id (
          full_name
        ),
        institution:institution_id (
          name
        )
      `)
      .in("status", ["submitted", "under_review", "verified", "revision_requested"])
      .order("submitted_at", { ascending: false });

    if (casesError) {
      return { success: false, error: casesError.message };
    }

    if (!casesData || casesData.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch linked competencies for these cases
    const caseIds = casesData.map((c: any) => c.id);
    const { data: compData } = await supabase
      .from("clinical_case_competencies")
      .select("case_log_id, competency_id")
      .in("case_log_id", caseIds);

    const compMap = new Map<string, string[]>();
    if (compData) {
      compData.forEach((row: any) => {
        const existing = compMap.get(row.case_log_id) || [];
        existing.push(row.competency_id);
        compMap.set(row.case_log_id, existing);
      });
    }

    const formatted: ClinicalCaseLog[] = casesData.map((row: any) => {
      const studentObj = Array.isArray(row.student) ? row.student[0] : row.student;
      const institutionObj = Array.isArray(row.institution) ? row.institution[0] : row.institution;

      return {
        id: row.id,
        student_id: row.student_id,
        student_name: studentObj?.full_name || "Ayush Scholar",
        institution_name: institutionObj?.name || "Academic Institution",
        case_reference_token: row.case_reference_token,
        patient_age_group: row.patient_age_group || "Middle Adult (36-55 yrs)",
        patient_gender: row.patient_gender || "other",
        department: row.department,
        encounter_date: row.encounter_date,
        chief_complaint: row.chief_complaint,
        clinical_history: row.clinical_history || "",
        prakriti_assessment: row.prakriti_assessment || undefined,
        examination_findings: row.examination_findings || undefined,
        provisional_diagnosis: row.provisional_diagnosis,
        namaste_code: row.namaste_code || undefined,
        namaste_term: row.namaste_term || undefined,
        icd11_tm2_code: row.icd11_tm2_code || undefined,
        treatment_plan: row.treatment_plan,
        learning_reflections: row.learning_reflections || undefined,
        competency_ids: compMap.get(row.id) || [],
        status: row.status as ClinicalCaseStatus,
        faculty_id: row.faculty_id || undefined,
        faculty_name: profile.full_name || undefined,
        faculty_feedback: row.faculty_feedback || undefined,
        submitted_at: row.submitted_at || undefined,
        verified_at: row.verified_at || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return { success: true, data: formatted };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch faculty review queue." };
  }
}

/**
 * Claim a submitted case for review (submitted -> under_review).
 * Locks the case under the claiming faculty member's ID.
 */
export async function claimCaseUnderReviewAction(caseId: string): Promise<FacultyActionResult<null>> {
  try {
    const { user } = await requireRole("faculty");
    const supabase = await createClient();

    const { error } = await supabase
      .from("clinical_case_logs")
      .update({
        status: "under_review",
        faculty_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .eq("status", "submitted");

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/faculty/elogbook");
    revalidatePath(`/student/elogbook/${caseId}`);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to claim case under review." };
  }
}

/**
 * Verify and sign off a clinical case log (submitted / under_review -> verified).
 * Permanently seals the case record.
 */
export async function verifyCaseLogAction(
  caseId: string,
  feedback: string
): Promise<FacultyActionResult<null>> {
  try {
    const { user } = await requireRole("faculty");
    const supabase = await createClient();

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("clinical_case_logs")
      .update({
        status: "verified",
        faculty_id: user.id,
        faculty_feedback: feedback.trim() || null,
        verified_at: now,
        updated_at: now,
      })
      .eq("id", caseId)
      .in("status", ["submitted", "under_review"]);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/faculty/elogbook");
    revalidatePath(`/student/elogbook/${caseId}`);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify case log." };
  }
}

/**
 * Request revisions on a case log (submitted / under_review -> revision_requested).
 * Requires actionable supervisory feedback.
 */
export async function requestRevisionAction(
  caseId: string,
  feedback: string
): Promise<FacultyActionResult<null>> {
  try {
    const { user } = await requireRole("faculty");
    const supabase = await createClient();

    if (!feedback || feedback.trim().length === 0) {
      return { success: false, error: "Supervisory feedback is required when requesting case revisions." };
    }

    const { error } = await supabase
      .from("clinical_case_logs")
      .update({
        status: "revision_requested",
        faculty_id: user.id,
        faculty_feedback: feedback.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .in("status", ["submitted", "under_review"]);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/faculty/elogbook");
    revalidatePath(`/student/elogbook/${caseId}`);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to request case revision." };
  }
}

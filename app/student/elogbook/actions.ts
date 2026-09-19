"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  ClinicalCaseLog,
  CaseLogFormData,
  ClinicalCaseStatus,
} from "@/lib/elogbook/types";

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isTableMissing?: boolean;
}

/**
 * Checks if a Supabase PostgREST error is due to missing tables (e.g. 42P01)
 */
function checkIsTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = err.code || "";
  return (
    code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("relation \"public.clinical_case_logs\" does not exist")
  );
}

/**
 * Fetch all clinical case logs belonging to the authenticated student from Supabase.
 */
export async function fetchStudentCaseLogsAction(): Promise<ActionResult<ClinicalCaseLog[]>> {
  try {
    const { user, profile } = await requireRole("student");
    const supabase = await createClient();

    // 1. Query case logs for authenticated student
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
        faculty:faculty_id (
          full_name,
          designation
        ),
        institution:institution_id (
          name
        )
      `)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (casesError) {
      if (checkIsTableMissingError(casesError)) {
        return {
          success: false,
          isTableMissing: true,
          error: "Database table 'clinical_case_logs' does not exist in the connected Supabase database. Please apply the migration 'supabase/migrations/20260919094830_clinical_elogbook_core.sql'.",
        };
      }
      return { success: false, error: casesError.message };
    }

    if (!casesData || casesData.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Fetch linked competency IDs for these cases
    const caseIds = casesData.map((c: any) => c.id);
    const { data: compData, error: compError } = await supabase
      .from("clinical_case_competencies")
      .select("case_log_id, competency_id")
      .in("case_log_id", caseIds);

    const compMap = new Map<string, string[]>();
    if (compData && !compError) {
      compData.forEach((row: any) => {
        const existing = compMap.get(row.case_log_id) || [];
        existing.push(row.competency_id);
        compMap.set(row.case_log_id, existing);
      });
    }

    // 3. Format into ClinicalCaseLog domain model
    const formattedCases: ClinicalCaseLog[] = casesData.map((row: any) => {
      const facultyObj = Array.isArray(row.faculty) ? row.faculty[0] : row.faculty;
      const institutionObj = Array.isArray(row.institution) ? row.institution[0] : row.institution;

      return {
        id: row.id,
        student_id: row.student_id,
        student_name: profile.full_name || "Ayush Scholar",
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
        faculty_name: facultyObj?.full_name || undefined,
        faculty_designation: facultyObj?.designation || undefined,
        faculty_feedback: row.faculty_feedback || undefined,
        submitted_at: row.submitted_at || undefined,
        verified_at: row.verified_at || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return { success: true, data: formattedCases };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch clinical case logs." };
  }
}

/**
 * Fetch a single case log by ID for the authenticated student.
 */
export async function fetchCaseLogByIdAction(caseId: string): Promise<ActionResult<ClinicalCaseLog>> {
  try {
    const { user, profile } = await requireRole("student");
    const supabase = await createClient();

    const { data: row, error } = await supabase
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
        faculty:faculty_id (
          full_name,
          designation
        ),
        institution:institution_id (
          name
        )
      `)
      .eq("id", caseId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (error) {
      if (checkIsTableMissingError(error)) {
        return {
          success: false,
          isTableMissing: true,
          error: "Database table 'clinical_case_logs' does not exist in Supabase.",
        };
      }
      return { success: false, error: error.message };
    }

    if (!row) {
      return { success: false, error: "Clinical case log not found or access denied." };
    }

    // Fetch linked competencies
    const { data: compData } = await supabase
      .from("clinical_case_competencies")
      .select("competency_id")
      .eq("case_log_id", row.id);

    const competencyIds = compData ? compData.map((c: any) => c.competency_id) : [];
    const facultyObj = Array.isArray(row.faculty) ? row.faculty[0] : row.faculty;
    const institutionObj = Array.isArray(row.institution) ? row.institution[0] : row.institution;

    const caseLog: ClinicalCaseLog = {
      id: row.id,
      student_id: row.student_id,
      student_name: profile.full_name || "Ayush Scholar",
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
      competency_ids: competencyIds,
      status: row.status as ClinicalCaseStatus,
      faculty_id: row.faculty_id || undefined,
      faculty_name: facultyObj?.full_name || undefined,
      faculty_designation: facultyObj?.designation || undefined,
      faculty_feedback: row.faculty_feedback || undefined,
      submitted_at: row.submitted_at || undefined,
      verified_at: row.verified_at || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    return { success: true, data: caseLog };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch clinical case log." };
  }
}

/**
 * Create a new clinical case log in Supabase.
 * Student ID and Institution ID are strictly derived from trusted session on server.
 */
export async function createCaseLogAction(formData: CaseLogFormData): Promise<ActionResult<ClinicalCaseLog>> {
  try {
    const { user, profile } = await requireRole("student");
    const supabase = await createClient();

    if (!profile.institution_id) {
      return {
        success: false,
        error: "Your student profile is not linked to an accredited academic institution. Please update your profile.",
      };
    }

    const isSubmitted = formData.status === "submitted";
    const nowIso = new Date().toISOString();

    // 1. Insert parent case log row
    const { data: newRow, error: insertError } = await supabase
      .from("clinical_case_logs")
      .insert({
        student_id: user.id, // Strictly server-derived
        institution_id: profile.institution_id, // Strictly server-derived
        case_reference_token: formData.case_reference_token.trim() || `CASE-${Date.now().toString().slice(-4)}`,
        patient_age_group: formData.patient_age_group,
        patient_gender: formData.patient_gender,
        department: formData.department,
        encounter_date: formData.encounter_date,
        chief_complaint: formData.chief_complaint.trim(),
        clinical_history: formData.clinical_history.trim(),
        prakriti_assessment: formData.prakriti_assessment?.trim() || null,
        examination_findings: formData.examination_findings?.trim() || null,
        provisional_diagnosis: formData.provisional_diagnosis.trim(),
        namaste_code: formData.namaste_code || null,
        namaste_term: formData.namaste_term || null,
        icd11_tm2_code: formData.icd11_tm2_code || null,
        treatment_plan: formData.treatment_plan.trim(),
        learning_reflections: formData.learning_reflections?.trim() || null,
        status: isSubmitted ? "submitted" : "draft",
        submitted_at: isSubmitted ? nowIso : null,
      })
      .select()
      .single();

    if (insertError) {
      if (checkIsTableMissingError(insertError)) {
        return {
          success: false,
          isTableMissing: true,
          error: "Database table 'clinical_case_logs' does not exist in Supabase.",
        };
      }
      return { success: false, error: insertError.message };
    }

    // 2. Insert competency junction links if specified
    if (formData.competency_ids && formData.competency_ids.length > 0) {
      const compRows = formData.competency_ids.map((compId) => ({
        case_log_id: newRow.id,
        competency_id: compId,
      }));

      const { error: compErr } = await supabase
        .from("clinical_case_competencies")
        .insert(compRows);

      if (compErr) {
        console.warn("Could not link competencies (competency IDs may be mock IDs):", compErr.message);
      }
    }

    revalidatePath("/student/elogbook");

    const createdCase: ClinicalCaseLog = {
      id: newRow.id,
      student_id: user.id,
      student_name: profile.full_name || "Ayush Scholar",
      institution_name: "Academic Institution",
      case_reference_token: newRow.case_reference_token,
      patient_age_group: newRow.patient_age_group,
      patient_gender: newRow.patient_gender,
      department: newRow.department,
      encounter_date: newRow.encounter_date,
      chief_complaint: newRow.chief_complaint,
      clinical_history: newRow.clinical_history,
      prakriti_assessment: newRow.prakriti_assessment || undefined,
      examination_findings: newRow.examination_findings || undefined,
      provisional_diagnosis: newRow.provisional_diagnosis,
      namaste_code: newRow.namaste_code || undefined,
      namaste_term: newRow.namaste_term || undefined,
      icd11_tm2_code: newRow.icd11_tm2_code || undefined,
      treatment_plan: newRow.treatment_plan,
      learning_reflections: newRow.learning_reflections || undefined,
      competency_ids: formData.competency_ids || [],
      status: newRow.status as ClinicalCaseStatus,
      submitted_at: newRow.submitted_at || undefined,
      created_at: newRow.created_at,
      updated_at: newRow.updated_at,
    };

    return { success: true, data: createdCase };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create clinical case log." };
  }
}

/**
 * Update an existing draft or revision_requested clinical case log in Supabase.
 */
export async function updateCaseLogAction(
  caseId: string,
  formData: Partial<CaseLogFormData>
): Promise<ActionResult<ClinicalCaseLog>> {
  try {
    const { user, profile } = await requireRole("student");
    const supabase = await createClient();

    // 1. Verify case ownership and permitted status
    const { data: existing, error: fetchErr } = await supabase
      .from("clinical_case_logs")
      .select("id, status, student_id")
      .eq("id", caseId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { success: false, error: "Case not found or permission denied." };
    }

    if (existing.status !== "draft" && existing.status !== "revision_requested") {
      return {
        success: false,
        error: `Cannot modify a case currently in '${existing.status}' status. Only draft and revision-requested cases can be edited.`,
      };
    }

    const isSubmitting = formData.status === "submitted";
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (formData.case_reference_token !== undefined) updatePayload.case_reference_token = formData.case_reference_token.trim();
    if (formData.patient_age_group !== undefined) updatePayload.patient_age_group = formData.patient_age_group;
    if (formData.patient_gender !== undefined) updatePayload.patient_gender = formData.patient_gender;
    if (formData.department !== undefined) updatePayload.department = formData.department;
    if (formData.encounter_date !== undefined) updatePayload.encounter_date = formData.encounter_date;
    if (formData.chief_complaint !== undefined) updatePayload.chief_complaint = formData.chief_complaint.trim();
    if (formData.clinical_history !== undefined) updatePayload.clinical_history = formData.clinical_history.trim();
    if (formData.prakriti_assessment !== undefined) updatePayload.prakriti_assessment = formData.prakriti_assessment.trim() || null;
    if (formData.examination_findings !== undefined) updatePayload.examination_findings = formData.examination_findings.trim() || null;
    if (formData.provisional_diagnosis !== undefined) updatePayload.provisional_diagnosis = formData.provisional_diagnosis.trim();
    if (formData.namaste_code !== undefined) updatePayload.namaste_code = formData.namaste_code || null;
    if (formData.namaste_term !== undefined) updatePayload.namaste_term = formData.namaste_term || null;
    if (formData.icd11_tm2_code !== undefined) updatePayload.icd11_tm2_code = formData.icd11_tm2_code || null;
    if (formData.treatment_plan !== undefined) updatePayload.treatment_plan = formData.treatment_plan.trim();
    if (formData.learning_reflections !== undefined) updatePayload.learning_reflections = formData.learning_reflections.trim() || null;
    
    if (isSubmitting) {
      updatePayload.status = "submitted";
      updatePayload.submitted_at = new Date().toISOString();
    }

    // 2. Perform row update
    const { data: updatedRow, error: updateErr } = await supabase
      .from("clinical_case_logs")
      .update(updatePayload)
      .eq("id", caseId)
      .eq("student_id", user.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 3. Update competencies if supplied
    if (formData.competency_ids) {
      await supabase.from("clinical_case_competencies").delete().eq("case_log_id", caseId);
      if (formData.competency_ids.length > 0) {
        const compRows = formData.competency_ids.map((cId) => ({
          case_log_id: caseId,
          competency_id: cId,
        }));
        await supabase.from("clinical_case_competencies").insert(compRows);
      }
    }

    revalidatePath("/student/elogbook");
    revalidatePath(`/student/elogbook/${caseId}`);

    const result = await fetchCaseLogByIdAction(caseId);
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update clinical case log." };
  }
}

/**
 * Delete a draft clinical case log in Supabase.
 */
export async function deleteDraftCaseLogAction(caseId: string): Promise<ActionResult<null>> {
  try {
    const { user } = await requireRole("student");
    const supabase = await createClient();

    // 1. Verify case is draft and owned by student
    const { data: target, error: fetchErr } = await supabase
      .from("clinical_case_logs")
      .select("id, status, student_id")
      .eq("id", caseId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (fetchErr || !target) {
      return { success: false, error: "Case not found or permission denied." };
    }

    if (target.status !== "draft") {
      return { success: false, error: "Only draft cases can be deleted." };
    }

    // 2. Delete row (attachments and competencies cascade)
    const { error: delErr } = await supabase
      .from("clinical_case_logs")
      .delete()
      .eq("id", caseId)
      .eq("student_id", user.id);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    revalidatePath("/student/elogbook");
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete draft case log." };
  }
}

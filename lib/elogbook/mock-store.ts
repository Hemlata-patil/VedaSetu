/**
 * NAMASTE e-Logbook Phase 3: Client-side Mock Store
 *
 * Provides in-browser persistent demonstration state using localStorage.
 * Preloaded with realistic Ayurveda clinical cases across all lifecycle statuses:
 * - Verified (with faculty sign-off & remarks)
 * - Submitted (under review queue)
 * - Revision Requested (with corrective instructions)
 * - Draft (in progress by student)
 *
 * NOTE: Strictly isolated to client-side demo state. No Supabase connection is made.
 */

import { ClinicalCaseLog, CaseLogFormData } from "./types";

const STORAGE_KEY = "vedasetu_elogbook_demo_cases";

export const INITIAL_MOCK_CASES: ClinicalCaseLog[] = [
  {
    id: "case-demo-001",
    student_id: "student-current-user",
    student_name: "Ayush Scholar",
    institution_name: "National Institute of Ayurveda (NIA), Jaipur",
    case_reference_token: "CASE-2026-KC-01",
    patient_age_group: "Middle Adult (36-55 yrs)",
    patient_gender: "female",
    department: "Kayachikitsa",
    encounter_date: "2026-09-15",
    chief_complaint: "Bilateral knee joint pain with early morning stiffness (> 1 hour) and swelling for 4 months.",
    clinical_history: "Aggravated during cold and cloudy weather. Associated with heaviness in abdomen and loss of appetite (Agnimandya). No history of major trauma.",
    prakriti_assessment: "Vata-Kapha Prakriti with dominant Vata-Kapha Vikriti.",
    examination_findings: "Sandhi-shotha (knee swelling) with Sparsha-asahyatva (tenderness). Nadi: Manda, Gambhira. Jihva: Sama (coated tongue indicative of Ama).",
    provisional_diagnosis: "Amavata (Rheumatoid Arthritis presentation)",
    namaste_code: "SAMPLE-AYU-001",
    namaste_term: "Amavata (आमवात)",
    icd11_tm2_code: "TM2-AYU-042",
    treatment_plan: "1. Deepana-Pachana with Shunthi-Dhanyaka Kwatha (40ml BD).\n2. Simhanada Guggulu (2 tabs TDS with warm water).\n3. Valuka Sweda locally on bilateral knee joints for 7 days.\n4. Advised Laghu, Ruksha Ahara and avoided Curd/Masha.",
    learning_reflections: "Understood the critical role of Langhana and Deepana-Pachana in early Amavata before administering Balya or Brimhana medicines. Observed rapid relief in morning stiffness with Valuka Sweda.",
    competency_ids: ["comp-01", "comp-02", "comp-03", "comp-05", "comp-06"],
    status: "verified",
    faculty_id: "faculty-01",
    faculty_name: "Dr. Rajesh Sharma, MD (Ayu)",
    faculty_designation: "Professor & HOD, Dept. of Kayachikitsa",
    faculty_feedback: "Excellent documentation of Ama lakshanas and Jihva pariksha. Rational selection of Simhanada Guggulu and Valuka Sweda for Amavata. Competency verified.",
    submitted_at: "2026-09-15T14:30:00Z",
    verified_at: "2026-09-16T10:15:00Z",
    created_at: "2026-09-15T11:00:00Z",
    updated_at: "2026-09-16T10:15:00Z",
  },
  {
    id: "case-demo-002",
    student_id: "student-current-user",
    student_name: "Ayush Scholar",
    institution_name: "National Institute of Ayurveda (NIA), Jaipur",
    case_reference_token: "CASE-2026-ST-02",
    patient_age_group: "Elderly (56+ yrs)",
    patient_gender: "male",
    department: "Shalya Tantra",
    encounter_date: "2026-09-17",
    chief_complaint: "Painful nodular swelling in perianal region with purulent discharge for 2 weeks.",
    clinical_history: "Recurrent history of perianal abscess drained 6 months prior. History of chronic constipation (Vibandha).",
    prakriti_assessment: "Pitta-Vata Prakriti.",
    examination_findings: "Inspection: External opening at 6 o'clock position discharging seropurulent fluid. Digital Rectal Exam: Internal opening palpable at dentate line.",
    provisional_diagnosis: "Bhagandara (Fistula-in-Ano / Ushtra-greeva type)",
    namaste_code: "SAMPLE-AYU-007",
    namaste_term: "Bhagandara (भगन्दर)",
    icd11_tm2_code: "TM2-AYU-088",
    treatment_plan: "1. Ksharasutra therapy planned under local anesthesia.\n2. Triphala Guggulu (2 tabs BD).\n3. Jatyadi Taila Matra Basti.\n4. Daily lukewarm Panchavalkala Kashaya Avagaha Sweda (Sitz bath).",
    learning_reflections: "Observed Goodsall's rule application and the technique of gentle probing for internal opening identification. Appreciated Ksharasutra's dual action of cutting and curettage.",
    competency_ids: ["comp-01", "comp-02", "comp-03", "comp-07"],
    status: "submitted",
    submitted_at: "2026-09-17T16:45:00Z",
    created_at: "2026-09-17T15:20:00Z",
    updated_at: "2026-09-17T16:45:00Z",
  },
  {
    id: "case-demo-003",
    student_id: "student-current-user",
    student_name: "Ayush Scholar",
    institution_name: "National Institute of Ayurveda (NIA), Jaipur",
    case_reference_token: "CASE-2026-PK-03",
    patient_age_group: "Young Adult (19-35 yrs)",
    patient_gender: "female",
    department: "Panchakarma",
    encounter_date: "2026-09-14",
    chief_complaint: "Recurrent episodes of breathlessness, wheezing, and dry cough aggravated at night.",
    clinical_history: "Symptoms worse during rainy season and after cold food exposure. Relieved temporarily by warm beverages.",
    prakriti_assessment: "Vata-Kapha Prakriti.",
    examination_findings: "Chest Auscultation: Bilateral rhonchi and prolonged expiration. Nadi: Chapala (rapid), Vata-Kapha dominant.",
    provisional_diagnosis: "Tamaka Shwasa (Bronchial Asthma presentation)",
    namaste_code: "SAMPLE-AYU-004",
    namaste_term: "Tamaka Shwasa (तमक श्वास)",
    icd11_tm2_code: "TM2-AYU-061",
    treatment_plan: "1. Sthanika Snehana with Til Taila + Lavana followed by Nadi Sweda on Uras (chest).\n2. Shringyadi Churna with Madhu.\n3. Kanakasava (15ml BD with equal warm water).",
    learning_reflections: "Observed immediate relief in chest tightness following localized Snehana and Swedana during mild paroxysmal episode.",
    competency_ids: ["comp-01", "comp-02", "comp-05", "comp-07"],
    status: "revision_requested",
    faculty_id: "faculty-02",
    faculty_name: "Dr. Ananya Joshi, MD (Panchakarma)",
    faculty_designation: "Associate Professor, Dept. of Panchakarma",
    faculty_feedback: "Good case choice. Please update the differential diagnosis to clearly differentiate between Vataja Shwasa and Tamaka Shwasa (Kaphadhika vs Vatadhika features) and record Peak Expiratory Flow or respiratory rate.",
    submitted_at: "2026-09-14T17:00:00Z",
    created_at: "2026-09-14T12:00:00Z",
    updated_at: "2026-09-15T09:30:00Z",
  },
  {
    id: "case-demo-004",
    student_id: "student-current-user",
    student_name: "Ayush Scholar",
    institution_name: "National Institute of Ayurveda (NIA), Jaipur",
    case_reference_token: "CASE-2026-KC-04",
    patient_age_group: "Middle Adult (36-55 yrs)",
    patient_gender: "male",
    department: "Kayachikitsa",
    encounter_date: "2026-09-18",
    chief_complaint: "Yellowish discoloration of sclera and skin, mild loss of appetite, dark yellow urine for 5 days.",
    clinical_history: "History of excessive intake of oily, spicy, and fried street foods. Mala: Pita-varna (clay-colored stool absent).",
    prakriti_assessment: "Pitta Pradhana Prakriti.",
    examination_findings: "Netra Pariksha: Haridra varna Netra (icteric sclera). Jihva: Alpa-rakta, Pita-lipta.",
    provisional_diagnosis: "Koshtashrita Kamala (Hepatocellular / Infective Jaundice)",
    namaste_code: "SAMPLE-AYU-006",
    namaste_term: "Kamala (कामला)",
    icd11_tm2_code: "TM2-AYU-055",
    treatment_plan: "Draft in progress: Planning Phalatrikadi Kwatha and Arogyavardhini Vati.",
    learning_reflections: "Reviewing classical differential diagnosis between Koshtashrita vs Shakhashrita Kamala.",
    competency_ids: ["comp-01", "comp-03"],
    status: "draft",
    created_at: "2026-09-18T10:00:00Z",
    updated_at: "2026-09-18T10:00:00Z",
  },
];

/**
 * Returns all clinical case logs from localStorage, with fallback to initial mock data.
 */
export function getCaseLogs(): ClinicalCaseLog[] {
  if (typeof window === "undefined") {
    return INITIAL_MOCK_CASES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_CASES));
      return INITIAL_MOCK_CASES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_MOCK_CASES;
  }
}

/**
 * Retrieves a single clinical case log by ID.
 */
export function getCaseLogById(id: string): ClinicalCaseLog | null {
  const cases = getCaseLogs();
  return cases.find((c) => c.id === id) || null;
}

/**
 * Creates and stores a new clinical case log.
 */
export function createCaseLog(formData: CaseLogFormData): ClinicalCaseLog {
  const cases = getCaseLogs();
  const now = new Date().toISOString();
  
  const newCase: ClinicalCaseLog = {
    id: `case-${Date.now()}`,
    student_id: "student-current-user",
    student_name: "Ayush Scholar",
    institution_name: "National Institute of Ayurveda (NIA), Jaipur",
    case_reference_token: formData.case_reference_token.trim() || `CASE-${Date.now().toString().slice(-4)}`,
    patient_age_group: formData.patient_age_group,
    patient_gender: formData.patient_gender,
    department: formData.department,
    encounter_date: formData.encounter_date,
    chief_complaint: formData.chief_complaint,
    clinical_history: formData.clinical_history,
    prakriti_assessment: formData.prakriti_assessment,
    examination_findings: formData.examination_findings,
    provisional_diagnosis: formData.provisional_diagnosis,
    namaste_code: formData.namaste_code,
    namaste_term: formData.namaste_term,
    icd11_tm2_code: formData.icd11_tm2_code,
    treatment_plan: formData.treatment_plan,
    learning_reflections: formData.learning_reflections,
    competency_ids: formData.competency_ids,
    status: formData.status,
    submitted_at: formData.status === "submitted" ? now : undefined,
    created_at: now,
    updated_at: now,
  };

  const updatedCases = [newCase, ...cases];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCases));
  }
  return newCase;
}

/**
 * Updates an existing draft or revision_requested case log.
 */
export function updateCaseLog(id: string, formData: Partial<CaseLogFormData>): ClinicalCaseLog | null {
  const cases = getCaseLogs();
  const index = cases.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const existing = cases[index];
  // Security rule: Only draft and revision_requested cases can be edited by student
  if (existing.status !== "draft" && existing.status !== "revision_requested") {
    throw new Error(`Cannot modify case in ${existing.status} status.`);
  }

  const now = new Date().toISOString();
  const newStatus = formData.status || existing.status;
  
  const updatedCase: ClinicalCaseLog = {
    ...existing,
    case_reference_token: formData.case_reference_token ?? existing.case_reference_token,
    patient_age_group: formData.patient_age_group ?? existing.patient_age_group,
    patient_gender: formData.patient_gender ?? existing.patient_gender,
    department: formData.department ?? existing.department,
    encounter_date: formData.encounter_date ?? existing.encounter_date,
    chief_complaint: formData.chief_complaint ?? existing.chief_complaint,
    clinical_history: formData.clinical_history ?? existing.clinical_history,
    prakriti_assessment: formData.prakriti_assessment ?? existing.prakriti_assessment,
    examination_findings: formData.examination_findings ?? existing.examination_findings,
    provisional_diagnosis: formData.provisional_diagnosis ?? existing.provisional_diagnosis,
    namaste_code: formData.namaste_code ?? existing.namaste_code,
    namaste_term: formData.namaste_term ?? existing.namaste_term,
    icd11_tm2_code: formData.icd11_tm2_code ?? existing.icd11_tm2_code,
    treatment_plan: formData.treatment_plan ?? existing.treatment_plan,
    learning_reflections: formData.learning_reflections ?? existing.learning_reflections,
    competency_ids: formData.competency_ids ?? existing.competency_ids,
    status: newStatus,
    submitted_at: newStatus === "submitted" ? now : existing.submitted_at,
    updated_at: now,
  };

  cases[index] = updatedCase;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  }
  return updatedCase;
}

/**
 * Deletes a draft case log.
 */
export function deleteCaseLog(id: string): boolean {
  const cases = getCaseLogs();
  const target = cases.find((c) => c.id === id);
  if (!target) return false;

  if (target.status !== "draft") {
    throw new Error("Only draft cases can be deleted.");
  }

  const filtered = cases.filter((c) => c.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
  return true;
}

/**
 * Resets local demo state back to default mock cases.
 */
export function resetToMockData(): ClinicalCaseLog[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_CASES));
  }
  return INITIAL_MOCK_CASES;
}

/**
 * NAMASTE e-Logbook Phase 3: Student e-Logbook Types
 *
 * Defines the contract for clinical case logs, status lifecycle,
 * synthetic references, and competency evidence linking.
 */

export type ClinicalCaseStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "revision_requested";

export type AyurvedaDepartment =
  | "Kayachikitsa"
  | "Shalya Tantra"
  | "Shalakya Tantra"
  | "Prasuti & Stri Roga"
  | "Kaumarbhritya"
  | "Panchakarma"
  | "Swasthavritta"
  | "Agada Tantra"
  | "Other";

export type PatientAgeGroup =
  | "Paediatric (0-14 yrs)"
  | "Adolescent (15-18 yrs)"
  | "Young Adult (19-35 yrs)"
  | "Middle Adult (36-55 yrs)"
  | "Elderly (56+ yrs)";

export interface ClinicalCompetency {
  id: string;
  code: string;
  title: string;
  domain: "Cognitive" | "Psychomotor" | "Affective";
  level: string;
  description: string;
}

export interface ClinicalCaseLog {
  id: string;
  student_id: string;
  student_name: string;
  institution_name: string;
  
  // Patient Privacy (Strictly De-identified)
  case_reference_token: string;
  patient_age_group: PatientAgeGroup;
  patient_gender: "male" | "female" | "other";
  
  // Clinical Context
  department: AyurvedaDepartment;
  encounter_date: string; // YYYY-MM-DD
  
  // Clinical Observations & Findings
  chief_complaint: string;
  clinical_history: string;
  prakriti_assessment?: string;
  examination_findings?: string;
  provisional_diagnosis: string;
  
  // Standardized Terminology References
  namaste_code?: string;
  namaste_term?: string;
  icd11_tm2_code?: string;
  
  // Treatment Regimen & Student Learning Reflections
  treatment_plan: string;
  learning_reflections?: string;
  
  // Competencies Tagged
  competency_ids: string[];
  
  // Review Lifecycle & Faculty Supervision
  status: ClinicalCaseStatus;
  faculty_id?: string;
  faculty_name?: string;
  faculty_designation?: string;
  faculty_feedback?: string;
  submitted_at?: string;
  verified_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface CaseLogFormData {
  case_reference_token: string;
  patient_age_group: PatientAgeGroup;
  patient_gender: "male" | "female" | "other";
  department: AyurvedaDepartment;
  encounter_date: string;
  chief_complaint: string;
  clinical_history: string;
  prakriti_assessment: string;
  examination_findings: string;
  provisional_diagnosis: string;
  namaste_code?: string;
  namaste_term?: string;
  icd11_tm2_code?: string;
  treatment_plan: string;
  learning_reflections: string;
  competency_ids: string[];
  status: "draft" | "submitted";
}

export const AYURVEDA_DEPARTMENTS: AyurvedaDepartment[] = [
  "Kayachikitsa",
  "Shalya Tantra",
  "Shalakya Tantra",
  "Prasuti & Stri Roga",
  "Kaumarbhritya",
  "Panchakarma",
  "Swasthavritta",
  "Agada Tantra",
  "Other",
];

export const PATIENT_AGE_GROUPS: PatientAgeGroup[] = [
  "Paediatric (0-14 yrs)",
  "Adolescent (15-18 yrs)",
  "Young Adult (19-35 yrs)",
  "Middle Adult (36-55 yrs)",
  "Elderly (56+ yrs)",
];

export const NCISM_CLINICAL_COMPETENCIES: ClinicalCompetency[] = [
  {
    id: "comp-01",
    code: "AYU-UG-DOC-01",
    title: "Clinical Documentation & Record Keeping",
    domain: "Cognitive",
    level: "UG 3rd/4th Prof",
    description: "Record structured clinical case histories, Rogi Pariksha findings, and daily progress accurately.",
  },
  {
    id: "comp-02",
    code: "AYU-UG-EXAM-02",
    title: "Clinical History Taking & Ashtavidha Pariksha",
    domain: "Psychomotor",
    level: "UG 3rd/4th Prof",
    description: "Perform structured Nadi, Mutra, Mala, Jihva, Shabda, Sparsha, Drik, and Akriti clinical examination.",
  },
  {
    id: "comp-03",
    code: "AYU-UG-DIAG-03",
    title: "Clinical Interpretation & Roga Vinishchaya",
    domain: "Cognitive",
    level: "UG 3rd/4th Prof",
    description: "Formulate differential diagnosis based on Dosha-Dushya Sammurchhana and Vyadhi Nidana.",
  },
  {
    id: "comp-04",
    code: "AYU-UG-COMM-04",
    title: "Patient Communication & Pathya Counseling",
    domain: "Affective",
    level: "UG 3rd/4th Prof",
    description: "Explain disease etiology, lifestyle modifications (Ahara/Vihara), and obtain informed consent empathetically.",
  },
  {
    id: "comp-05",
    code: "AYU-UG-PRAK-05",
    title: "Prakriti Assessment & Dosha Analysis",
    domain: "Cognitive",
    level: "UG 2nd/3rd Prof",
    description: "Assess Sharirika and Manasika Prakriti to tailor personalized therapeutic interventions.",
  },
  {
    id: "comp-06",
    code: "AYU-UG-PHARM-06",
    title: "Classical Ayurveda Formulations & Dosage",
    domain: "Cognitive",
    level: "UG 3rd/4th Prof",
    description: "Select appropriate Kwatha, Vati, Churna, or Taila combinations with proper Anupana and Matra.",
  },
  {
    id: "comp-07",
    code: "AYU-UG-PANCH-07",
    title: "Panchakarma & Upakarma Clinical Observation",
    domain: "Psychomotor",
    level: "UG 4th Prof",
    description: "Observe or assist Snehana, Swedana, Vamana, Virechana, Basti, Nasya, or Raktamokshana protocols.",
  },
];

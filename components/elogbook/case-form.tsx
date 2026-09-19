"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClinicalCaseLog,
  CaseLogFormData,
  AyurvedaDepartment,
  PatientAgeGroup,
  AYURVEDA_DEPARTMENTS,
  PATIENT_AGE_GROUPS,
  NCISM_CLINICAL_COMPETENCIES,
} from "@/lib/elogbook/types";
import {
  createCaseLogAction,
  updateCaseLogAction,
} from "@/app/student/elogbook/actions";
import { searchTerminology } from "@/lib/terminology/search";
import { SampleTerminologyItem } from "@/lib/terminology/types";
import sampleCatalog from "@/data/terminology/namaste-sample-catalog.json";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  X,
  RefreshCw,
  Award,
  BookOpen,
  Building2,
  ArrowLeft,
  Database,
} from "lucide-react";

interface CaseFormProps {
  existingCase?: ClinicalCaseLog;
  isEditMode?: boolean;
}

export function CaseForm({ existingCase, isEditMode = false }: CaseFormProps) {
  const router = useRouter();

  // Form State
  const [caseToken, setCaseToken] = React.useState(
    existingCase?.case_reference_token || `CASE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [ageGroup, setAgeGroup] = React.useState<PatientAgeGroup>(
    existingCase?.patient_age_group || "Middle Adult (36-55 yrs)"
  );
  const [gender, setGender] = React.useState<"male" | "female" | "other">(
    existingCase?.patient_gender || "male"
  );
  const [department, setDepartment] = React.useState<AyurvedaDepartment>(
    existingCase?.department || "Kayachikitsa"
  );
  const [encounterDate, setEncounterDate] = React.useState(
    existingCase?.encounter_date || new Date().toISOString().split("T")[0]
  );
  const [chiefComplaint, setChiefComplaint] = React.useState(existingCase?.chief_complaint || "");
  const [clinicalHistory, setClinicalHistory] = React.useState(existingCase?.clinical_history || "");
  const [prakritiAssessment, setPrakritiAssessment] = React.useState(existingCase?.prakriti_assessment || "");
  const [examinationFindings, setExaminationFindings] = React.useState(existingCase?.examination_findings || "");
  const [provisionalDiagnosis, setProvisionalDiagnosis] = React.useState(existingCase?.provisional_diagnosis || "");
  
  // Terminology Selection State
  const [selectedNamasteCode, setSelectedNamasteCode] = React.useState<string>(existingCase?.namaste_code || "");
  const [selectedNamasteTerm, setSelectedNamasteTerm] = React.useState<string>(existingCase?.namaste_term || "");
  const [selectedIcd11Code, setSelectedIcd11Code] = React.useState<string>(existingCase?.icd11_tm2_code || "");
  
  // Treatment & Reflections
  const [treatmentPlan, setTreatmentPlan] = React.useState(existingCase?.treatment_plan || "");
  const [learningReflections, setLearningReflections] = React.useState(existingCase?.learning_reflections || "");
  
  // Competencies
  const [selectedCompetencies, setSelectedCompetencies] = React.useState<string[]>(
    existingCase?.competency_ids || ["comp-01", "comp-02", "comp-03"]
  );

  // Terminology Modal / Search State
  const [isTerminologyModalOpen, setIsTerminologyModalOpen] = React.useState(false);
  const [termSearchQuery, setTermSearchQuery] = React.useState("");
  const [termCategoryFilter, setTermCategoryFilter] = React.useState<string>("all");
  
  // Validation & Submission State
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = React.useState(false);

  // Filtered Terminology Search Results
  const terminologyResults = React.useMemo(() => {
    return searchTerminology(
      {
        query: termSearchQuery,
        category: termCategoryFilter as any,
      },
      sampleCatalog as SampleTerminologyItem[]
    );
  }, [termSearchQuery, termCategoryFilter]);

  const generateNewToken = () => {
    const deptPrefix = department.slice(0, 2).toUpperCase();
    const randNum = Math.floor(100 + Math.random() * 900);
    setCaseToken(`CASE-${new Date().getFullYear()}-${deptPrefix}-${randNum}`);
  };

  const handleSelectTerminology = (item: SampleTerminologyItem) => {
    setSelectedNamasteCode(item.code);
    setSelectedNamasteTerm(`${item.term}${item.transliteration ? ` (${item.transliteration})` : ""}`);
    setSelectedIcd11Code(item.code.replace("SAMPLE-AYU", "TM2-AYU"));
    setIsTerminologyModalOpen(false);
  };

  const toggleCompetency = (compId: string) => {
    if (selectedCompetencies.includes(compId)) {
      setSelectedCompetencies(selectedCompetencies.filter((id) => id !== compId));
    } else {
      setSelectedCompetencies([...selectedCompetencies, compId]);
    }
  };

  const validateForm = (isSubmittingForReview: boolean): boolean => {
    const errors: Record<string, string> = {};

    if (!caseToken.trim()) {
      errors.caseToken = "Synthetic case reference is required.";
    }

    if (!chiefComplaint.trim()) {
      errors.chiefComplaint = "Chief complaint is required.";
    }

    if (!provisionalDiagnosis.trim()) {
      errors.provisionalDiagnosis = "Provisional diagnosis is required.";
    }

    if (isSubmittingForReview) {
      if (!treatmentPlan.trim()) {
        errors.treatmentPlan = "Treatment/management plan is required for faculty review.";
      }
      if (!clinicalHistory.trim()) {
        errors.clinicalHistory = "Clinical history / Hetu is required for submission.";
      }
      if (selectedCompetencies.length === 0) {
        errors.competencies = "Please tag at least one relevant clinical competency.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (actionType: "draft" | "submitted") => {
    setSubmissionError(null);
    setIsTableMissing(false);

    const isValid = validateForm(actionType === "submitted");
    if (!isValid) {
      const firstError = Object.values(formErrors)[0];
      alert(`Please check form requirements: ${firstError || "Missing required clinical fields."}`);
      return;
    }

    setIsSubmitting(true);

    const payload: CaseLogFormData = {
      case_reference_token: caseToken.trim(),
      patient_age_group: ageGroup,
      patient_gender: gender,
      department,
      encounter_date: encounterDate,
      chief_complaint: chiefComplaint.trim(),
      clinical_history: clinicalHistory.trim(),
      prakriti_assessment: prakritiAssessment.trim(),
      examination_findings: examinationFindings.trim(),
      provisional_diagnosis: provisionalDiagnosis.trim(),
      namaste_code: selectedNamasteCode || undefined,
      namaste_term: selectedNamasteTerm || undefined,
      icd11_tm2_code: selectedIcd11Code || undefined,
      treatment_plan: treatmentPlan.trim(),
      learning_reflections: learningReflections.trim(),
      competency_ids: selectedCompetencies,
      status: actionType,
    };

    try {
      let res;
      if (isEditMode && existingCase) {
        res = await updateCaseLogAction(existingCase.id, payload);
      } else {
        res = await createCaseLogAction(payload);
      }

      if (res.success) {
        router.push("/student/elogbook");
      } else {
        if (res.isTableMissing) {
          setIsTableMissing(true);
          setSubmissionError(
            res.error || "Database table 'clinical_case_logs' does not exist in Supabase yet. Please apply migration draft."
          );
        } else {
          setSubmissionError(res.error || "Failed to persist clinical case log in Supabase.");
        }
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setSubmissionError(err.message || "An unexpected error occurred while saving to Supabase.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header & Back Button */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/student/elogbook"
          className="inline-flex items-center text-sm font-medium text-ayush-muted hover:text-ayush-brown transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Case Logbook
        </Link>
        <Badge variant="herbal" dot>
          {isEditMode ? "Editing Case Record" : "New Clinical Entry"}
        </Badge>
      </div>

      {/* SUBMISSION ERROR / TABLE MISSING BANNER */}
      {submissionError && (
        <div className={`p-4 rounded-xl border text-xs space-y-2 ${
          isTableMissing
            ? "border-ayush-saffron/40 bg-ayush-saffron/10 text-ayush-dark"
            : "border-ayush-terracotta/40 bg-ayush-terracotta/10 text-ayush-dark"
        }`}>
          <div className="flex items-center gap-2 font-bold font-heading">
            {isTableMissing ? (
              <Database className="w-4 h-4 text-ayush-saffron shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-ayush-terracotta shrink-0" />
            )}
            <span>{isTableMissing ? "Supabase Migration Prerequisite Required" : "Database Persistence Error"}</span>
          </div>
          <p className="pl-6 text-xs text-ayush-dark/90 leading-relaxed">
            {submissionError}
          </p>
          {isTableMissing && (
            <p className="pl-6 text-[11px] text-ayush-muted">
              Target migration proposal: <code className="font-mono text-ayush-brown">supabase/migrations/drafts/20260919_phase5_elogbook_final_proposal.sql</code>
            </p>
          )}
        </div>
      )}

      {/* REVISION REQUESTED FEEDBACK BANNER IF IN EDIT MODE */}
      {isEditMode && existingCase?.status === "revision_requested" && existingCase.faculty_feedback && (
        <div className="p-4 rounded-xl border border-ayush-terracotta/40 bg-ayush-terracotta/10 space-y-1.5">
          <div className="flex items-center gap-2 text-ayush-terracotta font-semibold text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Faculty Revision Remarks — Action Required:
          </div>
          <p className="text-xs text-ayush-dark/90 italic pl-6">
            "{existingCase.faculty_feedback}"
          </p>
          <p className="text-[11px] text-ayush-muted pl-6">
            Reviewer: {existingCase.faculty_name || "Supervising Faculty"}
          </p>
        </div>
      )}

      {/* PATIENT PRIVACY SAFEGUARD NOTICE */}
      <div className="p-4 rounded-xl border border-ayush-terracotta/30 bg-ayush-terracotta/10 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-ayush-terracotta mt-0.5 shrink-0" />
        <div className="text-xs space-y-1 text-ayush-dark/80">
          <p className="font-bold text-ayush-terracotta uppercase tracking-wide">
            Mandatory Patient Privacy & De-Identification Safeguard
          </p>
          <p>
            Do <strong>NOT</strong> enter patient real names, phone numbers, Aadhaar numbers, ABHA IDs, residential addresses, or real hospital OPD/CR numbers anywhere in this form. Use strictly synthetic case tokens (e.g. <code>CASE-01</code>) and broad age categories.
          </p>
        </div>
      </div>

      {/* SECTION 1: CASE IDENTIFIERS & CLINICAL CONTEXT */}
      <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
        <CardHeader className="pb-3 border-b border-ayush-border/40">
          <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ayush-brown" />
            1. Clinical Encounter & De-identified Identifiers
          </CardTitle>
          <CardDescription className="text-xs text-ayush-muted">
            Define the clinical department, date of examination, and synthetic reference token.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Synthetic Token */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Synthetic Case Token *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={caseToken}
                  onChange={(e) => setCaseToken(e.target.value)}
                  placeholder="e.g. CASE-2026-01"
                  className="w-full text-xs font-mono py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateNewToken}
                  title="Generate new synthetic code"
                  className="px-2.5 h-8 text-xs shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
              {formErrors.caseToken && (
                <p className="text-[11px] text-ayush-terracotta mt-1">{formErrors.caseToken}</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Ayurveda Speciality / Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as AyurvedaDepartment)}
                className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark font-medium"
              >
                {AYURVEDA_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Encounter Date */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Encounter Date *
              </label>
              <input
                type="date"
                value={encounterDate}
                onChange={(e) => setEncounterDate(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ayush-border/40">
            {/* Age Group */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Patient Age Group (De-identified)
              </label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as PatientAgeGroup)}
                className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark font-medium"
              >
                {PATIENT_AGE_GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Patient Gender
              </label>
              <div className="flex items-center gap-3 pt-1">
                {(["male", "female", "other"] as const).map((g) => (
                  <label key={g} className="inline-flex items-center gap-1.5 text-xs text-ayush-dark cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={gender === g}
                      onChange={() => setGender(g)}
                      className="text-ayush-green focus:ring-ayush-green"
                    />
                    <span className="capitalize">{g}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: CLINICAL OBSERVATIONS & ROGI PARIKSHA */}
      <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
        <CardHeader className="pb-3 border-b border-ayush-border/40">
          <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-ayush-brown" />
            2. Clinical History & Rogi Pariksha Findings
          </CardTitle>
          <CardDescription className="text-xs text-ayush-muted">
            Record presenting symptoms, chronicity, Hetu (etiology), and examination notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Chief Complaint */}
          <div>
            <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
              Chief Complaint (Pradhāna Vedanā) *
            </label>
            <textarea
              rows={2}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Bilateral knee joint pain with early morning stiffness and swelling for 4 months..."
              className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark"
            />
            {formErrors.chiefComplaint && (
              <p className="text-[11px] text-ayush-terracotta mt-1">{formErrors.chiefComplaint}</p>
            )}
          </div>

          {/* Clinical History & Hetu */}
          <div>
            <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
              Clinical History & Hetu (Etiological Factors / Purvaroopa)
            </label>
            <textarea
              rows={2}
              value={clinicalHistory}
              onChange={(e) => setClinicalHistory(e.target.value)}
              placeholder="e.g. Aggravated during cloudy/cold weather. Associated with Agnimandya and Aruchi..."
              className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark"
            />
            {formErrors.clinicalHistory && (
              <p className="text-[11px] text-ayush-terracotta mt-1">{formErrors.clinicalHistory}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prakriti Assessment */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Prakriti Assessment & Dosha Analysis
              </label>
              <input
                type="text"
                value={prakritiAssessment}
                onChange={(e) => setPrakritiAssessment(e.target.value)}
                placeholder="e.g. Vata-Kapha Prakriti with dominant Vata-Kapha Vikriti"
                className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark"
              />
            </div>

            {/* Examination Findings */}
            <div>
              <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
                Ashtavidha Pariksha / Vital Examination Notes
              </label>
              <input
                type="text"
                value={examinationFindings}
                onChange={(e) => setExaminationFindings(e.target.value)}
                placeholder="e.g. Nadi: Manda, Gambhira; Jihva: Sama (Ama lakshana present)"
                className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: DIAGNOSIS & STANDARDIZED TERMINOLOGY MAPPING */}
      <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
        <CardHeader className="pb-3 border-b border-ayush-border/40">
          <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-ayush-saffron" />
              3. Diagnosis & Standardized Terminology Coding
            </span>
            <Button
              type="button"
              variant="heritage"
              size="sm"
              onClick={() => setIsTerminologyModalOpen(true)}
              className="text-xs h-8"
            >
              <Search className="w-3.5 h-3.5 mr-1 text-ayush-saffron" />
              Search Sample Terminology
            </Button>
          </CardTitle>
          <CardDescription className="text-xs text-ayush-muted">
            Map provisional classical diagnosis to standardized Ayush and dual ICD-11 TM2 codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Provisional Diagnosis */}
          <div>
            <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
              Provisional Clinical Diagnosis (Roga Vinishchaya) *
            </label>
            <input
              type="text"
              value={provisionalDiagnosis}
              onChange={(e) => setProvisionalDiagnosis(e.target.value)}
              placeholder="e.g. Amavata (Rheumatoid Arthritis presentation)"
              className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark font-semibold"
            />
            {formErrors.provisionalDiagnosis && (
              <p className="text-[11px] text-ayush-terracotta mt-1">{formErrors.provisionalDiagnosis}</p>
            )}
          </div>

          {/* Selected Terminology Display Box */}
          {selectedNamasteTerm ? (
            <div className="p-3.5 bg-ayush-green/10 border border-ayush-green/30 rounded-xl flex items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ayush-green">{selectedNamasteTerm}</span>
                  <Badge variant="herbal" className="text-[10px] font-mono">
                    {selectedNamasteCode}
                  </Badge>
                  {selectedIcd11Code && (
                    <Badge variant="saffron" className="text-[10px] font-mono">
                      {selectedIcd11Code}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-ayush-muted">
                  Standardized Ayurveda terminology selected from Phase 1 catalog.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedNamasteCode("");
                  setSelectedNamasteTerm("");
                  setSelectedIcd11Code("");
                }}
                className="text-xs text-ayush-muted hover:text-ayush-terracotta h-7 px-2"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div
              onClick={() => setIsTerminologyModalOpen(true)}
              className="p-4 border-2 border-dashed border-ayush-border/80 hover:border-ayush-green/60 rounded-xl cursor-pointer text-center space-y-1 transition-colors bg-ayush-sand/20"
            >
              <Sparkles className="w-5 h-5 text-ayush-muted mx-auto" />
              <p className="text-xs font-semibold text-ayush-brown">
                No standardized NAMASTE terminology attached yet
              </p>
              <p className="text-[11px] text-ayush-muted">
                Click here to browse and attach standardized Ayush disease or symptom codes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: TREATMENT & LEARNING REFLECTIONS */}
      <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
        <CardHeader className="pb-3 border-b border-ayush-border/40">
          <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
            <Award className="w-4 h-4 text-ayush-brown" />
            4. Treatment Regimen & Student Learning Reflections
          </CardTitle>
          <CardDescription className="text-xs text-ayush-muted">
            Detail the observed Chikitsa plan (Shamana/Shodhana) and clinical reflection.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Treatment Plan */}
          <div>
            <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
              Treatment / Management Plan Observed (Chikitsā Kram) *
            </label>
            <textarea
              rows={3}
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              placeholder="e.g. 1. Deepana-Pachana with Shunthi-Dhanyaka Kwatha (40ml BD)&#10;2. Simhanada Guggulu (2 tabs TDS)&#10;3. Valuka Sweda on knee joints for 7 days..."
              className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark font-mono"
            />
            {formErrors.treatmentPlan && (
              <p className="text-[11px] text-ayush-terracotta mt-1">{formErrors.treatmentPlan}</p>
            )}
          </div>

          {/* Learning Reflections */}
          <div>
            <label className="block text-xs font-semibold text-ayush-brown mb-1.5">
              Student Learning Reflections & Key Insights
            </label>
            <textarea
              rows={2}
              value={learningReflections}
              onChange={(e) => setLearningReflections(e.target.value)}
              placeholder="e.g. Learned the importance of prioritizing Deepana-Pachana in early Amavata before administering Brimhana drugs..."
              className="w-full text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border rounded-lg focus:ring-2 focus:ring-ayush-green focus:outline-none text-ayush-dark"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 5: NCISM COMPETENCY MAPPING */}
      <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
        <CardHeader className="pb-3 border-b border-ayush-border/40">
          <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
            <Award className="w-4 h-4 text-ayush-green" />
            5. NCISM Competency Mapping
          </CardTitle>
          <CardDescription className="text-xs text-ayush-muted">
            Select the clinical skills and competencies demonstrated in this case encounter.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {NCISM_CLINICAL_COMPETENCIES.map((comp) => {
              const isSelected = selectedCompetencies.includes(comp.id);
              return (
                <div
                  key={comp.id}
                  onClick={() => toggleCompetency(comp.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? "bg-ayush-green/10 border-ayush-green/40 shadow-sm"
                      : "bg-ayush-sand/20 border-ayush-border hover:border-ayush-green/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-ayush-green focus:ring-ayush-green"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ayush-dark">{comp.title}</span>
                      <span className="font-mono text-[10px] text-ayush-muted">{comp.code}</span>
                    </div>
                    <p className="text-[11px] text-ayush-muted leading-relaxed line-clamp-2">
                      {comp.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {formErrors.competencies && (
            <p className="text-[11px] text-ayush-terracotta mt-1">{formErrors.competencies}</p>
          )}
        </CardContent>
      </Card>

      {/* FORM ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-ayush-border/60">
        <Link href="/student/elogbook" className="w-full sm:w-auto">
          <Button variant="outline" type="button" className="w-full sm:w-auto text-xs">
            Cancel
          </Button>
        </Link>

        <Button
          type="button"
          variant="heritage"
          onClick={() => handleSubmit("draft")}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs"
        >
          {isSubmitting ? (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          Save as Draft
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSubmit("submitted")}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs font-semibold shadow-warm"
        >
          {isSubmitting ? (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 mr-1.5" />
          )}
          Submit for Faculty Review
        </Button>
      </div>

      {/* TERMINOLOGY SELECTION MODAL */}
      {isTerminologyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ayush-card border border-ayush-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-warm-lg overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-4 border-b border-ayush-border/60 flex items-center justify-between bg-ayush-sand/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-ayush-saffron" />
                <div>
                  <h3 className="text-base font-bold text-ayush-dark font-heading">
                    Select Standardized Ayurveda Term
                  </h3>
                  <p className="text-xs text-ayush-muted">
                    NAMASTE & ICD-11 TM2 sample terminology catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTerminologyModalOpen(false)}
                className="p-1 rounded-lg text-ayush-muted hover:text-ayush-dark hover:bg-ayush-sand/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Category Filter */}
            <div className="p-4 border-b border-ayush-border/40 space-y-3 bg-ayush-sand/10">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ayush-muted" />
                <input
                  type="text"
                  placeholder="Search Sanskrit term, English description, or sample code..."
                  value={termSearchQuery}
                  onChange={(e) => setTermSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-ayush-card border border-ayush-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ayush-green text-ayush-dark font-medium"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                {["all", "disease", "symptom", "pariksha", "procedure", "formulation"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTermCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize ${
                      termCategoryFilter === cat
                        ? "bg-ayush-brown text-ayush-card"
                        : "bg-ayush-sand/60 text-ayush-brown hover:bg-ayush-sand"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Results List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-[50vh]">
              {terminologyResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-ayush-muted">
                  No matching terminology items found in catalog.
                </div>
              ) : (
                terminologyResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectTerminology(item)}
                    className="p-3 rounded-xl border border-ayush-border/70 hover:border-ayush-green/60 hover:bg-ayush-green/5 cursor-pointer transition-all space-y-1 bg-ayush-card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ayush-dark">{item.term}</span>
                        {item.transliteration && (
                          <span className="text-xs text-ayush-muted italic">
                            ({item.transliteration})
                          </span>
                        )}
                      </div>
                      <Badge variant="herbal" className="font-mono text-[10px]">
                        {item.code}
                      </Badge>
                    </div>
                    <p className="text-xs text-ayush-muted/90 line-clamp-2">
                      {item.description}
                    </p>
                    {item.alternative_terms && item.alternative_terms.length > 0 && (
                      <p className="text-[10px] text-ayush-brown/70">
                        Aliases: {item.alternative_terms.join(", ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

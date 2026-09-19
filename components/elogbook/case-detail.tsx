"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClinicalCaseLog,
  ClinicalCaseStatus,
  NCISM_CLINICAL_COMPETENCIES,
} from "@/lib/elogbook/types";
import { deleteDraftCaseLogAction } from "@/app/student/elogbook/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit3,
  Trash2,
  Building2,
  Calendar,
  Sparkles,
  Tag,
  Award,
  BookOpen,
  User,
  ShieldCheck,
  FileText,
  Activity,
  Stethoscope,
  Loader2,
} from "lucide-react";

interface CaseDetailProps {
  caseLog: ClinicalCaseLog;
}

export function CaseDetail({ caseLog }: CaseDetailProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isEditable = caseLog.status === "draft" || caseLog.status === "revision_requested";
  const isDraft = caseLog.status === "draft";

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete draft case "${caseLog.case_reference_token}"?`)) {
      setIsDeleting(true);
      try {
        const res = await deleteDraftCaseLogAction(caseLog.id);
        if (!res.success) {
          alert(res.error || "Failed to delete case.");
          setIsDeleting(false);
          return;
        }
        router.push("/student/elogbook");
      } catch (err: any) {
        alert(err.message || "Failed to delete case.");
        setIsDeleting(false);
      }
    }
  };

  // Map competency details
  const taggedCompetencies = NCISM_CLINICAL_COMPETENCIES.filter((c) =>
    caseLog.competency_ids.includes(c.id)
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/student/elogbook"
          className="inline-flex items-center text-sm font-medium text-ayush-muted hover:text-ayush-brown transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Case Logbook
        </Link>

        <div className="flex items-center gap-2">
          {isEditable && (
            <Link href={`/student/elogbook/${caseLog.id}/edit`}>
              <Button
                variant={caseLog.status === "revision_requested" ? "saffron" : "default"}
                size="sm"
                className="text-xs font-semibold shadow-warm"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                {caseLog.status === "revision_requested" ? "Correct & Resubmit Case" : "Edit Draft"}
              </Button>
            </Link>
          )}

          {isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-xs text-ayush-terracotta border-ayush-terracotta/30 hover:bg-ayush-terracotta/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Draft
            </Button>
          )}
        </div>
      </div>

      {/* LIFECYCLE PROGRESS TRACKER */}
      <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-ayush-border/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ayush-brown px-2.5 py-0.5 bg-ayush-sand/80 rounded border border-ayush-border">
                  {caseLog.case_reference_token}
                </span>
                <span className="text-sm font-semibold text-ayush-dark">
                  {caseLog.department} Speciality
                </span>
              </div>
              <p className="text-xs text-ayush-muted mt-1">
                Recorded for clinical training at {caseLog.institution_name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {caseLog.status === "verified" && (
                <Badge variant="herbal" dot className="text-xs font-bold px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Verified & Signed Off
                </Badge>
              )}
              {caseLog.status === "submitted" && (
                <Badge variant="saffron" dot className="text-xs font-bold px-3 py-1">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Submitted for Review
                </Badge>
              )}
              {caseLog.status === "under_review" && (
                <Badge variant="saffron" dot className="text-xs font-bold px-3 py-1">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Faculty Under Review
                </Badge>
              )}
              {caseLog.status === "revision_requested" && (
                <Badge variant="destructive" dot className="text-xs font-bold px-3 py-1">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Revision Requested
                </Badge>
              )}
              {caseLog.status === "draft" && (
                <Badge variant="parchment" dot className="text-xs font-bold px-3 py-1">
                  <Edit3 className="w-3.5 h-3.5 mr-1" />
                  Draft In Progress
                </Badge>
              )}
            </div>
          </div>

          {/* Stepper Progression */}
          <div className="pt-4 grid grid-cols-4 gap-2 text-center">
            {/* Step 1: Draft */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${
                  ["draft", "submitted", "under_review", "verified", "revision_requested"].includes(
                    caseLog.status
                  )
                    ? "bg-ayush-green"
                    : "bg-ayush-border"
                }`}
              />
              <p className="text-[11px] font-semibold text-ayush-dark">1. Draft</p>
            </div>

            {/* Step 2: Submitted */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${
                  ["submitted", "under_review", "verified", "revision_requested"].includes(
                    caseLog.status
                  )
                    ? "bg-ayush-green"
                    : "bg-ayush-border"
                }`}
              />
              <p className="text-[11px] font-semibold text-ayush-dark">2. Submitted</p>
            </div>

            {/* Step 3: Faculty Review */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${
                  ["under_review", "verified", "revision_requested"].includes(caseLog.status)
                    ? caseLog.status === "revision_requested"
                      ? "bg-ayush-terracotta"
                      : "bg-ayush-green"
                    : "bg-ayush-border"
                }`}
              />
              <p className="text-[11px] font-semibold text-ayush-dark">3. Evaluation</p>
            </div>

            {/* Step 4: Verification */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${
                  caseLog.status === "verified"
                    ? "bg-ayush-green"
                    : caseLog.status === "revision_requested"
                    ? "bg-ayush-terracotta"
                    : "bg-ayush-border"
                }`}
              />
              <p className="text-[11px] font-semibold text-ayush-dark">
                {caseLog.status === "revision_requested" ? "Revision Required" : "4. Verified"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FACULTY REVIEW CALLOUT CARD */}
      {caseLog.faculty_feedback && (
        <Card
          className={`border ${
            caseLog.status === "verified"
              ? "border-ayush-green/40 bg-ayush-green/10"
              : "border-ayush-terracotta/40 bg-ayush-terracotta/10"
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold font-heading flex items-center justify-between text-ayush-dark">
              <span className="flex items-center gap-2">
                {caseLog.status === "verified" ? (
                  <ShieldCheck className="w-4 h-4 text-ayush-green" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-ayush-terracotta" />
                )}
                Faculty Supervision & Verification Report
              </span>
              {caseLog.verified_at && (
                <span className="text-xs font-normal text-ayush-muted">
                  Signed off: {new Date(caseLog.verified_at).toLocaleDateString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="p-3 bg-ayush-card/70 rounded-lg border border-ayush-border/40 space-y-1">
              <p className="font-semibold text-ayush-brown">
                {caseLog.faculty_name || "Faculty Supervisor"}
                {caseLog.faculty_designation && (
                  <span className="text-ayush-muted font-normal"> — {caseLog.faculty_designation}</span>
                )}
              </p>
              <p className="italic text-ayush-dark/90 text-sm leading-relaxed">
                "{caseLog.faculty_feedback}"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLINICAL ENCOUNTER DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Columns: Clinical Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Section: Diagnosis & Terminology */}
          <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-ayush-brown" />
                Roga Vinishchaya & Terminology Mapping
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                  Provisional Diagnosis (Classical Ayurveda)
                </p>
                <p className="text-base font-bold text-ayush-dark font-heading mt-0.5">
                  {caseLog.provisional_diagnosis}
                </p>
              </div>

              {/* Terminology Badges */}
              <div className="p-3.5 bg-ayush-sand/30 border border-ayush-border/60 rounded-xl space-y-2">
                <p className="text-[11px] font-semibold text-ayush-brown flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-ayush-saffron" />
                  Standardized Ayush Terminology (Phase 1 Integration)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {caseLog.namaste_term && (
                    <div className="px-2.5 py-1 bg-ayush-green/15 text-ayush-green font-semibold rounded-md border border-ayush-green/30">
                      {caseLog.namaste_term}
                    </div>
                  )}
                  {caseLog.namaste_code && (
                    <Badge variant="herbal" className="font-mono">
                      {caseLog.namaste_code}
                    </Badge>
                  )}
                  {caseLog.icd11_tm2_code && (
                    <Badge variant="saffron" className="font-mono">
                      <Tag className="w-3 h-3 mr-1" />
                      ICD-11: {caseLog.icd11_tm2_code}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section: Clinical History & Examination */}
          <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-ayush-brown" />
                Clinical Observations & Examination
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                  Chief Complaint (Pradhāna Vedanā)
                </p>
                <p className="text-xs text-ayush-dark mt-1 leading-relaxed bg-ayush-sand/20 p-2.5 rounded-lg border border-ayush-border/40">
                  {caseLog.chief_complaint}
                </p>
              </div>

              {caseLog.clinical_history && (
                <div>
                  <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                    Clinical History & Hetu (Etiology / Chronicity)
                  </p>
                  <p className="text-xs text-ayush-dark mt-1 leading-relaxed bg-ayush-sand/20 p-2.5 rounded-lg border border-ayush-border/40">
                    {caseLog.clinical_history}
                  </p>
                </div>
              )}

              {caseLog.prakriti_assessment && (
                <div>
                  <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                    Prakriti Assessment & Dosha Analysis
                  </p>
                  <p className="text-xs text-ayush-dark mt-1 font-medium bg-ayush-sand/20 p-2.5 rounded-lg border border-ayush-border/40">
                    {caseLog.prakriti_assessment}
                  </p>
                </div>
              )}

              {caseLog.examination_findings && (
                <div>
                  <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                    Ashtavidha Pariksha / Clinical Examination Findings
                  </p>
                  <p className="text-xs text-ayush-dark mt-1 leading-relaxed bg-ayush-sand/20 p-2.5 rounded-lg border border-ayush-border/40">
                    {caseLog.examination_findings}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Treatment Plan & Learning Reflections */}
          <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <CardTitle className="text-base font-bold text-ayush-dark font-heading flex items-center gap-2">
                <Activity className="w-4 h-4 text-ayush-green" />
                Treatment Plan & Student Reflections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                  Observed Chikitsa Regimen (Formulations & Procedures)
                </p>
                <pre className="text-xs font-mono text-ayush-dark mt-1 leading-relaxed bg-ayush-sand/30 p-3 rounded-lg border border-ayush-border/40 whitespace-pre-wrap">
                  {caseLog.treatment_plan}
                </pre>
              </div>

              {caseLog.learning_reflections && (
                <div>
                  <p className="text-[11px] font-semibold text-ayush-muted uppercase tracking-wider">
                    Student Clinical Learning Reflections
                  </p>
                  <p className="text-xs text-ayush-dark mt-1 italic leading-relaxed bg-ayush-sand/20 p-3 rounded-lg border border-ayush-border/40">
                    "{caseLog.learning_reflections}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Metadata & Competencies */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <CardTitle className="text-sm font-bold text-ayush-dark font-heading flex items-center gap-2">
                <FileText className="w-4 h-4 text-ayush-brown" />
                Encounter Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-ayush-border/30">
                <span className="text-ayush-muted">Encounter Date:</span>
                <span className="font-semibold text-ayush-dark flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-ayush-muted" />
                  {caseLog.encounter_date}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-ayush-border/30">
                <span className="text-ayush-muted">Department:</span>
                <span className="font-semibold text-ayush-dark">{caseLog.department}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-ayush-border/30">
                <span className="text-ayush-muted">Age Category:</span>
                <span className="font-semibold text-ayush-dark">{caseLog.patient_age_group}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-ayush-border/30">
                <span className="text-ayush-muted">Gender:</span>
                <span className="font-semibold text-ayush-dark capitalize">{caseLog.patient_gender}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-ayush-border/30">
                <span className="text-ayush-muted">Student Author:</span>
                <span className="font-semibold text-ayush-dark">{caseLog.student_name}</span>
              </div>

              {caseLog.submitted_at && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-ayush-muted">Submitted On:</span>
                  <span className="font-mono text-[11px] text-ayush-dark">
                    {new Date(caseLog.submitted_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked NCISM Competencies */}
          <Card className="border-ayush-border/80 shadow-warm bg-ayush-card">
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <CardTitle className="text-sm font-bold text-ayush-dark font-heading flex items-center gap-2">
                <Award className="w-4 h-4 text-ayush-green" />
                NCISM Competencies ({taggedCompetencies.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {taggedCompetencies.length === 0 ? (
                <p className="text-xs text-ayush-muted italic">No competencies linked to this case.</p>
              ) : (
                taggedCompetencies.map((comp) => (
                  <div
                    key={comp.id}
                    className="p-2.5 rounded-lg bg-ayush-sand/30 border border-ayush-border/50 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ayush-dark">{comp.title}</span>
                      <span className="font-mono text-[10px] text-ayush-green">{comp.code}</span>
                    </div>
                    <p className="text-[11px] text-ayush-muted line-clamp-2">{comp.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

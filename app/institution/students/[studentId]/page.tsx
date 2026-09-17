import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildStudentSkillProfile, CATEGORY_CONFIG, CompetencyCategory } from "@/lib/competencies";
import {
  User,
  Building2,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  Clock,
  Award,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Student Academic & Skill Profile — Institution Oversight — VEDA SETU",
  description: "Collegiate oversight of student clinical competencies, academic growth, and mentorship status",
};

interface InstitutionStudentDetailPageProps {
  params: Promise<{ studentId: string }>;
}

async function InstitutionStudentDetailContent({ params }: InstitutionStudentDetailPageProps) {
  const { studentId } = await params;
  const { user, profile: institutionProfile } = await requireRole("institution");
  const supabase = await createClient();

  if (!institutionProfile?.institution_id) {
    notFound();
  }

  // 1. Fetch student profile with institution check
  const { data: student, error: stuErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, program, year, department, institution_id, created_at, institutions(id, name, state, code)")
    .eq("id", studentId)
    .maybeSingle();

  // STRICT INSTITUTIONAL BOUNDARY CHECK:
  // Institution users may only access students belonging to their own affiliated institution.
  if (
    stuErr ||
    !student ||
    student.role !== "student" ||
    student.institution_id !== institutionProfile.institution_id
  ) {
    notFound();
  }

  const institution = Array.isArray(student.institutions)
    ? student.institutions[0]
    : student.institutions;

  // 2. Fetch student competencies
  const { data: rawComps } = await supabase
    .from("student_competencies")
    .select("competency_id, proficiency_score, last_assessed_at, source, verified, competencies(id, name, category, description)")
    .eq("student_id", studentId);

  const skillProfile = buildStudentSkillProfile(rawComps || []);

  // 3. Fetch mentorship status & mentor name ONLY (MENTORSHIP PRIVACY: mentor_note excluded)
  const { data: mentorship } = await supabase
    .from("mentorships")
    .select("id, status, created_at, updated_at, faculty_id")
    .eq("student_id", studentId)
    .maybeSingle();

  let mentorName: string | null = null;
  if (mentorship?.faculty_id) {
    const { data: mentorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", mentorship.faculty_id)
      .maybeSingle();
    mentorName = mentorProfile?.full_name || "Faculty Mentor";
  }

  // 4. Fetch application counts via privacy RPC (APPLICATION PRIVACY: zero cover notes exposed)
  const { data: appStatsRows } = await supabase.rpc("get_institution_application_stats", {
    target_student_id: studentId,
  });

  const appStats = appStatsRows?.[0] || {
    total_count: 0,
    applied_count: 0,
    under_review_count: 0,
    shortlisted_count: 0,
    selected_count: 0,
    rejected_count: 0,
    withdrawn_count: 0,
  };

  return (
    <DashboardShell
      userRole="institution"
      userName={institutionProfile?.full_name || "Institution Administrator"}
      userEmail={user.email || "admin@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Institution Dashboard", href: "/institution/dashboard" },
        { label: "Students", href: "/institution/students" },
        { label: student.full_name || "Student Profile" },
      ]}
    >
      {/* Back button */}
      <div className="mb-4">
        <Button asChild size="sm" variant="ghost" className="gap-1.5 text-xs text-ayush-muted">
          <Link href="/institution/students">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Enrolled Students Directory</span>
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Collegiate Academic Oversight"
        eyebrowColor="brown"
        title={student.full_name || "Ayush Student"}
        description={`Standardized competency profile, curricular benchmarks, and clinical supervision.`}
        actions={
          <div className="flex items-center gap-2">
            {skillProfile.hasCompletedAssessment ? (
              <Badge variant="herbal">Assessment Completed</Badge>
            ) : (
              <Badge variant="parchment">Assessment Pending</Badge>
            )}
            {mentorship?.status === "active" && (
              <Badge variant="saffron" dot>Active Mentorship</Badge>
            )}
            {mentorship?.status === "completed" && (
              <Badge variant="herbal">Mentorship Completed</Badge>
            )}
          </div>
        }
      />

      {/* Student Academic Identity Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 rounded-lg bg-ayush-surface-raised border border-ayush-border/60 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ayush-surface flex items-center justify-center border border-ayush-border text-ayush-muted">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-ayush-text text-sm">{student.full_name || "Ayush Student"}</p>
            <p className="text-ayush-muted flex items-center gap-1.5 mt-0.5">
              <span>{student.program || "BAMS"}</span>
              <span>&bull;</span>
              <span>{student.year ? `Year ${student.year}` : "Enrolled"}</span>
              <span>&bull;</span>
              <span>{student.department || "Ayurveda Samhita & Siddhanta"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-ayush-muted">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>{institution?.name || "Affiliated Campus"}</span>
          </div>
          {skillProfile.lastAssessedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Assessed: {new Date(skillProfile.lastAssessedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Skill Profile & Competencies */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overall Score Card */}
          <Card accent="saffron" className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ayush-muted font-medium">Platform Skill Profile</span>
                <Badge variant={skillProfile.hasCompletedAssessment ? "saffron" : "parchment"}>
                  {skillProfile.hasCompletedAssessment ? "Verified Evaluation" : "Not Yet Assessed"}
                </Badge>
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-4xl font-extrabold text-ayush-text">
                  {skillProfile.hasCompletedAssessment ? `${skillProfile.overallScore}%` : "—"}
                </span>
                <span className="text-xs text-ayush-muted">
                  Composite proficiency across NCISM-aligned competency domains
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-ayush-surface rounded-full h-2 overflow-hidden border border-ayush-border/40">
                <div
                  className="bg-ayush-saffron h-full transition-all duration-500 rounded-full"
                  style={{ width: `${skillProfile.overallScore}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* 4 Category Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(CATEGORY_CONFIG) as CompetencyCategory[]).map((catKey) => {
              const catSummary = skillProfile.categorySummaries[catKey];
              const config = CATEGORY_CONFIG[catKey];

              return (
                <Card key={catKey}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ayush-muted">{config.shortLabel}</span>
                      <Badge variant={config.badgeVariant}>
                        {catSummary.competencyCount} Competencies
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-bold">
                      {catSummary.competencyCount > 0 ? `${catSummary.score}%` : "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-ayush-surface rounded-full h-1.5 overflow-hidden border border-ayush-border/30 mb-2">
                      <div
                        className="bg-ayush-green h-full rounded-full transition-all"
                        style={{ width: `${catSummary.score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-ayush-muted line-clamp-2">
                      {config.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Priority Development Areas */}
          {skillProfile.priorityDevelopmentAreas.length > 0 && (
            <Card accent="green">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-ayush-saffron" />
                  <span>Platform Development Indicators</span>
                </CardTitle>
                <p className="text-xs text-ayush-muted">
                  Competencies with lower evaluation scores where faculty coaching and clinical remediation deliver the highest academic impact.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {skillProfile.priorityDevelopmentAreas.map((area) => (
                  <div
                    key={area.id}
                    className="p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-xs font-semibold text-ayush-text">{area.name}</p>
                      <p className="text-[11px] text-ayush-muted mt-0.5">{area.description}</p>
                    </div>
                    <span className="text-xs font-bold text-ayush-saffron px-2 py-0.5 rounded bg-ayush-surface border border-ayush-border shrink-0">
                      {area.score}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Detailed Competency List */}
          {skillProfile.competencies.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-ayush-border/40">
                <CardTitle className="text-base">All Evaluated Competencies</CardTitle>
                <p className="text-xs text-ayush-muted">
                  Official clinical, diagnostic, and research competency scores recorded for this scholar.
                </p>
              </CardHeader>
              <CardContent className="pt-3 divide-y divide-ayush-border/40">
                {skillProfile.competencies.map((comp) => (
                  <div key={comp.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="font-medium text-ayush-text">{comp.name}</span>
                      <span className="text-ayush-muted ml-2 text-[11px]">
                        ({CATEGORY_CONFIG[comp.category]?.shortLabel || comp.category})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-ayush-text">{comp.score}%</span>
                      {comp.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-ayush-green" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Mentorship Status & Application Funnel */}
        <div className="space-y-6">
          {/* Mentorship Status Card (MENTORSHIP PRIVACY: Status & Mentor name only, zero notes) */}
          <Card accent="brown">
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-ayush-brown" />
                  <span>Academic Mentorship</span>
                </CardTitle>
                {mentorship?.status === "active" && (
                  <Badge variant="saffron" dot>Active</Badge>
                )}
                {mentorship?.status === "completed" && (
                  <Badge variant="herbal">Completed</Badge>
                )}
                {!mentorship && (
                  <Badge variant="default">Not Mentored</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              {mentorship ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-ayush-muted">Assigned Faculty Mentor:</span>
                    <strong className="text-ayush-text">{mentorName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ayush-muted">Status:</span>
                    <span className="capitalize font-medium text-ayush-text">{mentorship.status} Mentorship</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ayush-muted pt-2 border-t border-ayush-border/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last Interaction:
                    </span>
                    <span>{new Date(mentorship.updated_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-ayush-muted italic pt-1">
                    Guidance notes remain private between the student and faculty mentor.
                  </p>
                </>
              ) : (
                <p className="text-ayush-muted">
                  No 1-on-1 faculty mentorship relationship has been initiated for this student yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Application Outcomes Card (APPLICATION PRIVACY: Status counts only, zero cover notes) */}
          <Card>
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-ayush-muted" />
                <span>Industry Application Outcomes</span>
              </CardTitle>
              <p className="text-xs text-ayush-muted mt-0.5">
                Aggregate industry apprenticeship & placement activity
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
                <span className="text-ayush-muted">Total Applications Submitted:</span>
                <strong className="text-ayush-text">{Number(appStats.total_count || 0)}</strong>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-ayush-surface border border-ayush-border">
                  <span className="text-ayush-muted block text-[11px]">Under Review</span>
                  <strong className="text-ayush-text text-sm">{Number(appStats.under_review_count || 0)}</strong>
                </div>

                <div className="p-2.5 rounded-lg bg-ayush-surface border border-ayush-border">
                  <span className="text-ayush-muted block text-[11px]">Shortlisted</span>
                  <strong className="text-ayush-saffron text-sm">{Number(appStats.shortlisted_count || 0)}</strong>
                </div>

                <div className="p-2.5 rounded-lg bg-ayush-surface border border-ayush-border">
                  <span className="text-ayush-muted block text-[11px]">Selected</span>
                  <strong className="text-ayush-green text-sm">{Number(appStats.selected_count || 0)}</strong>
                </div>

                <div className="p-2.5 rounded-lg bg-ayush-surface border border-ayush-border">
                  <span className="text-ayush-muted block text-[11px]">Rejected / Closed</span>
                  <strong className="text-ayush-muted text-sm">{Number(appStats.rejected_count || 0)}</strong>
                </div>
              </div>

              <p className="text-[11px] text-ayush-muted italic pt-1">
                Student cover notes and proposal specifics are confidential to the candidate and hiring partner.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function InstitutionStudentDetailPage(props: InstitutionStudentDetailPageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Student Profile...</div>}>
      <InstitutionStudentDetailContent {...props} />
    </Suspense>
  );
}

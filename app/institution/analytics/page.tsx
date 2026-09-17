import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildStudentSkillProfile, CATEGORY_CONFIG, CompetencyCategory } from "@/lib/competencies";
import {
  BarChart3,
  Users,
  Award,
  GraduationCap,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Building2,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Institutional Analytics — VEDA SETU",
  description: "Aggregate cohort competency benchmarks, skill distributions, and application outcomes",
};

async function InstitutionAnalyticsContent() {
  const { user, profile } = await requireRole("institution");
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  if (!institutionId) {
    return (
      <DashboardShell
        userRole="institution"
        userName={profile?.full_name || "Institution Administrator"}
        userEmail={user.email || "admin@institution.edu.in"}
        breadcrumbs={[
          { label: "Ayush Portal", href: "/" },
          { label: "Institution Dashboard", href: "/institution/dashboard" },
          { label: "Analytics" },
        ]}
      >
        <PageHeader
          eyebrow="Intelligence & Outcomes"
          eyebrowColor="brown"
          title="Institutional Analytics"
          description="Collegiate competency intelligence, curriculum gap identification, and cohort metrics."
        />
        <div className="p-6 rounded-xl bg-ayush-parchment/10 border border-ayush-parchment/30">
          <p className="text-sm text-ayush-muted">
            Institutional affiliation is required to view institutional analytics.
          </p>
        </div>
      </DashboardShell>
    );
  }

  // 1. Fetch institution details
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, code, state")
    .eq("id", institutionId)
    .maybeSingle();

  // 2. Fetch all students in this institution
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, program, year, department, created_at")
    .eq("role", "student")
    .eq("institution_id", institutionId);

  const studentList = students || [];
  const totalStudents = studentList.length;
  const studentIds = studentList.map((s) => s.id);

  // 3. Fetch competencies for these students
  const { data: rawComps } = studentIds.length > 0
    ? await supabase
        .from("student_competencies")
        .select("competency_id, student_id, proficiency_score, last_assessed_at, competencies(id, name, category, description)")
        .in("student_id", studentIds)
    : { data: [] };

  // Group competencies by student
  const compsByStudent = new Map<string, any[]>();
  (rawComps || []).forEach((row: any) => {
    if (!compsByStudent.has(row.student_id)) {
      compsByStudent.set(row.student_id, []);
    }
    compsByStudent.get(row.student_id)!.push(row);
  });

  // Calculate assessed students count, category sums & competency-level gap counts
  let assessedStudentsCount = 0;

  // Domain category tracking across cohort
  const categoryAverages: Record<CompetencyCategory, { sum: number; count: number }> = {
    academic_domain: { sum: 0, count: 0 },
    clinical_practical: { sum: 0, count: 0 },
    research: { sum: 0, count: 0 },
    professional: { sum: 0, count: 0 },
  };

  // Gap tracking (< 60) per competency
  const competencyGapMap = new Map<string, { id: string; name: string; category: CompetencyCategory; count: number }>();

  studentList.forEach((st) => {
    const stComps = compsByStudent.get(st.id) || [];
    if (stComps.length > 0) {
      assessedStudentsCount += 1;
      const skillProfile = buildStudentSkillProfile(stComps);

      // Accumulate category averages
      (Object.keys(categoryAverages) as CompetencyCategory[]).forEach((catKey) => {
        const catSummary = skillProfile.categorySummaries[catKey];
        if (catSummary && catSummary.competencyCount > 0) {
          categoryAverages[catKey].sum += catSummary.score;
          categoryAverages[catKey].count += 1;
        }
      });

      // Track individual competencies below 60
      skillProfile.competencies.forEach((comp) => {
        if (comp.score < 60) {
          if (!competencyGapMap.has(comp.id)) {
            competencyGapMap.set(comp.id, {
              id: comp.id,
              name: comp.name,
              category: comp.category,
              count: 0,
            });
          }
          competencyGapMap.get(comp.id)!.count += 1;
        }
      });
    }
  });

  const completionPercentage = totalStudents > 0
    ? Math.round((assessedStudentsCount / totalStudents) * 100)
    : 0;

  // Sorted Priority Development Areas (competencies needing remediation most)
  const priorityDevelopmentAreas = Array.from(competencyGapMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // 4. Fetch application statistics via privacy RPC helper
  const { data: appStatsRows } = await supabase.rpc("get_institution_application_stats");
  const appStats = appStatsRows?.[0] || {
    total_count: 0,
    applied_count: 0,
    under_review_count: 0,
    shortlisted_count: 0,
    selected_count: 0,
    rejected_count: 0,
    withdrawn_count: 0,
  };

  // 5. Fetch mentorships for institution students
  const { data: mentorships } = studentIds.length > 0
    ? await supabase
        .from("mentorships")
        .select("id, status")
        .in("student_id", studentIds)
    : { data: [] };

  const totalMentorships = mentorships?.length || 0;
  const activeMentorships = (mentorships || []).filter((m) => m.status === "active").length;
  const completedMentorships = (mentorships || []).filter((m) => m.status === "completed").length;

  return (
    <DashboardShell
      userRole="institution"
      userName={profile?.full_name || "Institution Administrator"}
      userEmail={user.email || "admin@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Institution Dashboard", href: "/institution/dashboard" },
        { label: "Analytics" },
      ]}
    >
      <PageHeader
        eyebrow="Institutional Intelligence"
        eyebrowColor="brown"
        title="Institutional Analytics & Benchmarking"
        description={`Comprehensive competency benchmarks, priority development areas, and industry outcomes for ${institution?.name || "Affiliated Campus"}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/institution/students">
                <Users className="w-4 h-4 mr-1.5" />
                <span>View Students</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Institution Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-8 rounded-lg bg-ayush-surface-raised border border-ayush-border/60 text-xs">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-ayush-muted" />
          <span className="font-semibold text-ayush-text">{institution?.name}</span>
          <span className="text-ayush-muted">&bull; Code: {institution?.code || "INST"} &bull; {institution?.state}</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="herbal">NCISM Standardized Metrics</Badge>
          <span className="text-ayush-muted">{totalStudents} Total Cohort Scholars</span>
        </div>
      </div>

      <div className="space-y-8">
        {/* SECTION A: STUDENT OVERVIEW */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ayush-muted mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-ayush-saffron" />
            <span>A. Cohort Assessment Overview</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs text-ayush-muted">Total Enrolled Scholars</span>
                <CardTitle className="text-3xl font-bold mt-1">{totalStudents}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-ayush-muted">Undergraduate & postgraduate candidates</p>
              </CardContent>
            </Card>

            <Card accent="green">
              <CardHeader className="pb-2">
                <span className="text-xs text-ayush-muted">Assessed Scholars</span>
                <CardTitle className="text-3xl font-bold mt-1">{assessedStudentsCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-ayush-muted">Completed clinical & academic assessments</p>
              </CardContent>
            </Card>

            <Card accent="saffron">
              <CardHeader className="pb-2">
                <span className="text-xs text-ayush-muted">Evaluation Coverage Rate</span>
                <CardTitle className="text-3xl font-bold mt-1">{completionPercentage}%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-ayush-surface rounded-full h-1.5 overflow-hidden border border-ayush-border/30 mt-1">
                  <div className="bg-ayush-saffron h-full rounded-full transition-all" style={{ width: `${completionPercentage}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* SECTION B: SKILL OVERVIEW (4 CATEGORY AVERAGES) */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ayush-muted mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-ayush-green" />
            <span>B. Core Competency Domain Averages</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(CATEGORY_CONFIG) as CompetencyCategory[]).map((catKey) => {
              const config = CATEGORY_CONFIG[catKey];
              const stat = categoryAverages[catKey];
              const avgScore = stat.count > 0 ? Math.round(stat.sum / stat.count) : null;

              return (
                <Card key={catKey}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ayush-muted">{config.shortLabel}</span>
                      <Badge variant={config.badgeVariant}>
                        {stat.count} Assessed
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl font-bold">
                      {avgScore !== null ? `${avgScore}%` : "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-ayush-surface rounded-full h-1.5 overflow-hidden border border-ayush-border/30 mb-2">
                      <div
                        className="bg-ayush-green h-full rounded-full transition-all"
                        style={{ width: `${avgScore || 0}%` }}
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
        </div>

        {/* SECTION C: PRIORITY DEVELOPMENT AREAS (<60%) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ayush-muted flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-ayush-saffron" />
              <span>C. Priority Curricular Development Indicators</span>
            </h3>
            <span className="text-xs text-ayush-muted">
              Platform development indicator &bull; Score &lt; 60%
            </span>
          </div>

          <Card accent="green">
            <CardHeader className="pb-2 border-b border-ayush-border/40">
              <p className="text-xs text-ayush-text-muted leading-relaxed">
                Aggregated competencies with scores below 60% across evaluated students. Use these collegiate insights
                to structure faculty workshops, clinical case postings, and hands-on laboratory remediation.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {priorityDevelopmentAreas.length === 0 ? (
                <div className="text-center py-6 text-xs text-ayush-muted">
                  <CheckCircle2 className="w-6 h-6 text-ayush-green mx-auto mb-2" />
                  <span>No prevalent competency deficiencies identified across current cohort evaluations.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {priorityDevelopmentAreas.map((gap) => {
                    const pct = assessedStudentsCount > 0
                      ? Math.round((gap.count / assessedStudentsCount) * 100)
                      : 0;

                    return (
                      <div
                        key={gap.id}
                        className="p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-ayush-text">{gap.name}</p>
                          <p className="text-[11px] text-ayush-muted mt-0.5">
                            Domain: {CATEGORY_CONFIG[gap.category]?.shortLabel || gap.category}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-bold text-ayush-saffron">{gap.count} Scholars</span>
                            <span className="text-[11px] text-ayush-muted block">({pct}% of assessed cohort)</span>
                          </div>
                          <Badge variant="saffron">Remediation Focus</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SECTION D & E: APPLICATION OUTCOMES & MENTORSHIP OVERVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section D: Application Outcomes */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-ayush-muted mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-ayush-brown" />
              <span>D. Industry Application Outcomes</span>
            </h3>

            <Card>
              <CardHeader className="pb-3 border-b border-ayush-border/40">
                <CardTitle className="text-base">Placement & Opportunity Pipeline</CardTitle>
                <p className="text-xs text-ayush-muted">
                  Aggregate candidate progress across industry partnerships (privacy preserved)
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
                  <span className="text-ayush-muted">Total Applications:</span>
                  <strong className="text-ayush-text text-base">{Number(appStats.total_count || 0)}</strong>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-ayush-surface border border-ayush-border">
                    <span className="text-ayush-muted block text-[11px]">Under Review</span>
                    <strong className="text-ayush-text text-base">{Number(appStats.under_review_count || 0)}</strong>
                  </div>

                  <div className="p-3 rounded-lg bg-ayush-surface border border-ayush-border">
                    <span className="text-ayush-muted block text-[11px]">Shortlisted</span>
                    <strong className="text-ayush-saffron text-base">{Number(appStats.shortlisted_count || 0)}</strong>
                  </div>

                  <div className="p-3 rounded-lg bg-ayush-surface border border-ayush-border">
                    <span className="text-ayush-muted block text-[11px]">Selected</span>
                    <strong className="text-ayush-green text-base">{Number(appStats.selected_count || 0)}</strong>
                  </div>

                  <div className="p-3 rounded-lg bg-ayush-surface border border-ayush-border">
                    <span className="text-ayush-muted block text-[11px]">Rejected / Closed</span>
                    <strong className="text-ayush-muted text-base">{Number(appStats.rejected_count || 0)}</strong>
                  </div>
                </div>

                <p className="text-[11px] text-ayush-muted italic pt-1">
                  Individual candidate proposals and partner communications remain strictly confidential.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Section E: Mentorship Overview */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-ayush-muted mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-ayush-saffron" />
              <span>E. Mentorship Overview</span>
            </h3>

            <Card accent="brown">
              <CardHeader className="pb-3 border-b border-ayush-border/40">
                <CardTitle className="text-base">Faculty Mentorship Engagement</CardTitle>
                <p className="text-xs text-ayush-muted">
                  Collegiate mentorship coverage and completed lifecycle reviews
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
                  <span className="text-ayush-muted">Total Mentorship Relationships:</span>
                  <strong className="text-ayush-text text-base">{totalMentorships}</strong>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-ayush-surface border border-ayush-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-ayush-muted text-[11px]">Active Mentees</span>
                      <Badge variant="saffron" dot>Active</Badge>
                    </div>
                    <strong className="text-ayush-text text-xl">{activeMentorships}</strong>
                  </div>

                  <div className="p-3 rounded-lg bg-ayush-surface border border-ayush-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-ayush-muted text-[11px]">Completed</span>
                      <Badge variant="herbal">Archived</Badge>
                    </div>
                    <strong className="text-ayush-text text-xl">{completedMentorships}</strong>
                  </div>
                </div>

                <p className="text-[11px] text-ayush-muted italic pt-1">
                  Mentorship notes are kept confidential between faculty mentors and mentees.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function InstitutionAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Institutional Analytics...</div>}>
      <InstitutionAnalyticsContent />
    </Suspense>
  );
}

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildStudentSkillProfile } from "@/lib/competencies";
import {
  Users,
  Award,
  GraduationCap,
  Briefcase,
  BarChart3,
  Building2,
  ArrowUpRight,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  UserCheck,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Institution Dashboard — VEDA SETU",
  description: "Collegiate academic oversight, student competency tracking, and institutional analytics",
};

async function InstitutionDashboardContent() {
  const { user, profile } = await requireRole("institution");
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  if (!institutionId) {
    return (
      <DashboardShell
        userRole="institution"
        userName={profile?.full_name || "Collegiate Administrator"}
        userEmail={user.email || "admin@institution.edu.in"}
        breadcrumbs={[{ label: "Ayush Portal", href: "/" }, { label: "Institution Dashboard" }]}
      >
        <PageHeader
          eyebrow="Institution Portal"
          eyebrowColor="brown"
          title={`Welcome, ${profile?.full_name || "Institution Administrator"}`}
          description="Collegiate governance, cohort skill progression, and institutional analytics."
        />

        <div className="p-6 rounded-xl bg-ayush-parchment/10 border border-ayush-parchment/30 mb-8">
          <div className="flex items-start gap-4">
            <span className="p-3 rounded-lg bg-ayush-parchment/20 text-ayush-saffron shrink-0">
              <AlertCircle className="w-6 h-6" />
            </span>
            <div className="space-y-2">
              <h3 className="text-base font-medium text-ayush-text">
                Institutional Linkage Required
              </h3>
              <p className="text-sm text-ayush-text-muted leading-relaxed">
                Your administrative profile is not currently linked to an academic institution record.
                Institutional affiliation is required to monitor student cohorts and view aggregate metrics.
              </p>
              <div className="pt-2">
                <Button asChild size="sm" variant="saffron">
                  <Link href="/profile">Update Profile & Affiliation</Link>
                </Button>
              </div>
            </div>
          </div>
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

  // 2. Fetch students in this institution (enforced via RLS and filter)
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, role, program, year, department, created_at")
    .eq("role", "student")
    .eq("institution_id", institutionId);

  const studentList = students || [];
  const studentIds = studentList.map((s) => s.id);

  // 3. Fetch faculty in this institution (enforced via RLS and filter)
  const { data: facultyMembers } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "faculty")
    .eq("institution_id", institutionId);

  const totalFaculty = facultyMembers?.length || 0;

  // 4. Fetch competencies for institution students
  const { data: rawComps } = studentIds.length > 0
    ? await supabase
        .from("student_competencies")
        .select("competency_id, student_id, proficiency_score, last_assessed_at, source, verified, competencies(id, name, category, description)")
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

  // Calculate assessed students count & average skill profile score
  let assessedStudentsCount = 0;
  let totalOverallScoreSum = 0;

  studentList.forEach((st) => {
    const stComps = compsByStudent.get(st.id) || [];
    if (stComps.length > 0) {
      assessedStudentsCount += 1;
      const profileResult = buildStudentSkillProfile(stComps);
      totalOverallScoreSum += profileResult.overallScore;
    }
  });

  const averageSkillProfileScore = assessedStudentsCount > 0
    ? Math.round(totalOverallScoreSum / assessedStudentsCount)
    : null;

  // 5. Fetch mentorships for institution students (read-only; RLS-scoped)
  const { data: mentorships } = studentIds.length > 0
    ? await supabase
        .from("mentorships")
        .select("id, student_id, faculty_id, status")
        .in("student_id", studentIds)
    : { data: [] };

  const activeMentorshipsCount = (mentorships || []).filter((m) => m.status === "active").length;

  // 6. Fetch application stats via privacy-preserving RPC helper
  const { data: appStatsRows } = await supabase.rpc("get_institution_application_stats");
  const appStats = appStatsRows?.[0] || {
    total_count: 0,
    applied_count: 0,
    under_review_count: 0,
    shortlisted_count: 0,
    selected_count: 0,
    rejected_count: 0,
  };

  const totalApplications = Number(appStats.total_count || 0);
  const shortlistedApplications = Number(appStats.shortlisted_count || 0);
  const selectedApplications = Number(appStats.selected_count || 0);

  // 7. Fetch placement outcomes for institution students
  const { data: instPlacements } = studentIds.length > 0
    ? await supabase
        .from("internship_placements")
        .select(`
          id,
          status,
          engagement_type,
          applications!inner (
            id,
            student_id
          )
        `)
        .in("applications.student_id", studentIds)
    : { data: [] };

  const totalPlacementsCount = instPlacements?.length || 0;
  const activePlacementsCount = (instPlacements || []).filter(
    (p: any) => ["joined", "in_progress"].includes(p.status)
  ).length;
  const completedPlacementsCount = (instPlacements || []).filter(
    (p: any) => p.status === "completed"
  ).length;

  return (
    <DashboardShell
      userRole="institution"
      userName={profile?.full_name || "Institution Administrator"}
      userEmail={user.email || "admin@institution.edu.in"}
      breadcrumbs={[{ label: "Ayush Portal", href: "/" }, { label: "Institution Dashboard" }]}
    >
      <PageHeader
        eyebrow="Institution Administration"
        eyebrowColor="brown"
        title={`Welcome, ${profile?.full_name || "Administrator"}`}
        description={`Collegiate cohort skill monitoring and institutional governance for ${institution?.name || "Affiliated Campus"}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="default" className="bg-ayush-brown hover:bg-ayush-brown/90 text-white font-semibold gap-1.5 shadow-warm">
              <Link href="/institution/faculty?action=add">
                <Plus className="w-4 h-4" />
                <span>Add Faculty</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/institution/faculty">
                <GraduationCap className="w-4 h-4" />
                <span>Faculty Directory</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/institution/students">
                <Users className="w-4 h-4" />
                <span>View Students</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="saffron" className="gap-1.5">
              <Link href="/institution/analytics">
                <BarChart3 className="w-4 h-4" />
                <span>Institutional Analytics</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Institution Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-8 rounded-lg bg-ayush-surface-raised border border-ayush-border/60">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-lg bg-ayush-brown/10 text-ayush-brown">
            <Building2 className="w-6 h-6" />
          </span>
          <div>
            <h3 className="text-base font-bold text-ayush-text">{institution?.name || "Affiliated Institution"}</h3>
            <p className="text-xs text-ayush-muted">
              Campus Code: <strong className="text-ayush-text">{institution?.code || "INST"}</strong> &bull; {institution?.state || "India"} &bull; NCISM / Ayush Recognized
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="herbal">Academic Institution</Badge>
          <Badge variant="parchment">{totalFaculty} Faculty Members</Badge>
        </div>
      </div>

      {/* Primary Metrics Grid (7 Required Metrics + Total Faculty) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Metric 1: Total Students */}
        <Card accent="saffron">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Total Students</span>
              <Users className="w-4 h-4 text-ayush-saffron" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{studentList.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Enrolled students in collegiate cohort
            </p>
          </CardContent>
        </Card>

        {/* Metric 2: Assessed Students */}
        <Card accent="green">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Assessed Students</span>
              <Award className="w-4 h-4 text-ayush-green" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{assessedStudentsCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              {studentList.length > 0
                ? `${Math.round((assessedStudentsCount / studentList.length) * 100)}% evaluation rate`
                : "No students enrolled"}
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Average Skill Profile Score */}
        <Card accent="brown">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Avg Skill Profile Score</span>
              <Sparkles className="w-4 h-4 text-ayush-saffron" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {averageSkillProfileScore !== null ? `${averageSkillProfileScore}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Mean composite score across assessed students
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Active Mentorships */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Active Mentorships</span>
              <GraduationCap className="w-4 h-4 text-ayush-muted" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{activeMentorshipsCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Active 1-on-1 faculty mentorship relationships
            </p>
          </CardContent>
        </Card>

        {/* Metric 5: Total Applications */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Total Applications</span>
              <Briefcase className="w-4 h-4 text-ayush-muted" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{totalApplications}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Student submissions to industry opportunities
            </p>
          </CardContent>
        </Card>

        {/* Metric 6: Shortlisted Applications */}
        <Card accent="saffron">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Shortlisted</span>
              <Award className="w-4 h-4 text-ayush-saffron" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{shortlistedApplications}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Candidates advanced by industry partners
            </p>
          </CardContent>
        </Card>

        {/* Metric 7: Selected Applications */}
        <Card accent="green">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Selected</span>
              <CheckCircle2 className="w-4 h-4 text-ayush-green" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{selectedApplications}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Confirmed apprenticeships & placements
            </p>
          </CardContent>
        </Card>

        {/* Metric 8: Total Faculty */}
        <Link href="/institution/faculty" className="block group">
          <Card className="h-full hover:border-ayush-border transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ayush-muted">Campus Faculty</span>
                <UserCheck className="w-4 h-4 text-ayush-muted group-hover:text-ayush-brown transition-colors" />
              </div>
              <CardTitle className="text-2xl font-bold mt-1 group-hover:text-ayush-brown transition-colors">
                {totalFaculty}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-ayush-muted">
                Academic mentors affiliated with institution
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Operational Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohort Monitoring Card */}
        <Card>
          <CardHeader className="pb-3 border-b border-ayush-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Student Cohort Monitoring</CardTitle>
                <p className="text-xs text-ayush-muted mt-0.5">
                  Direct visibility into campus student evaluations and clinical progress
                </p>
              </div>
              <Button asChild size="sm" variant="ghost" className="gap-1 text-xs">
                <Link href="/institution/students">
                  <span>View All</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-xs text-ayush-text-muted leading-relaxed">
              Track individual student competencies across Academic & Domain, Clinical & Practical, Research,
              and Professional Practice. Access full profiles and monitor active faculty mentorship.
            </p>
            <div className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
              <span className="text-ayush-muted">Total Enrolled Cohort:</span>
              <strong className="text-ayush-text">{studentList.length} Students</strong>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
              <span className="text-ayush-muted">Competency Evaluations Completed:</span>
              <strong className="text-ayush-text">{assessedStudentsCount} Students ({studentList.length > 0 ? Math.round((assessedStudentsCount / studentList.length) * 100) : 0}%)</strong>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/institution/students">Open Cohort Directory</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Institutional Analytics Card */}
        <Card accent="saffron">
          <CardHeader className="pb-3 border-b border-ayush-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Institutional Analytics</CardTitle>
                <p className="text-xs text-ayush-muted mt-0.5">
                  Aggregate outcomes, domain benchmarking, and priority development areas
                </p>
              </div>
              <Button asChild size="sm" variant="ghost" className="gap-1 text-xs">
                <Link href="/institution/analytics">
                  <span>Deep Dive</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-xs text-ayush-text-muted leading-relaxed">
              Evaluate campus-wide strengths and curricular development priorities. Review application funnel metrics
              and mentorship coverage to drive collegiate excellence.
            </p>
            <div className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
              <span className="text-ayush-muted">Average Campus Proficiency:</span>
              <strong className="text-ayush-text">{averageSkillProfileScore !== null ? `${averageSkillProfileScore}%` : "Pending Evaluation"}</strong>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50 text-xs">
              <span className="text-ayush-muted">Industry Application Funnel:</span>
              <strong className="text-ayush-text">{totalApplications} Total &bull; {shortlistedApplications} Shortlisted &bull; {selectedApplications} Selected</strong>
            </div>
            <Button asChild size="sm" variant="saffron" className="w-full">
              <Link href="/institution/analytics">Open Institutional Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Internship & Placement Outcomes Summary Card */}
      <div className="mt-6">
        <Card accent="green">
          <CardHeader className="pb-3 border-b border-ayush-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Internship & Placement Outcomes</CardTitle>
                <p className="text-xs text-ayush-muted mt-0.5">
                  Track student transition from campus skill evaluation into enterprise apprenticeships and career roles
                </p>
              </div>
              <Button asChild size="sm" variant="default" className="gap-1 text-xs">
                <Link href="/institution/internship-placement">
                  <span>Oversight Registry</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl border border-ayush-border/50 bg-ayush-surface-raised space-y-1">
                <span className="text-xs text-ayush-muted block">Initiated Placements</span>
                <span className="font-heading text-2xl font-bold text-ayush-text">{totalPlacementsCount}</span>
                <span className="text-[11px] text-ayush-muted block">Total selections tracked</span>
              </div>

              <div className="p-3.5 rounded-xl border border-ayush-border/50 bg-ayush-surface-raised space-y-1">
                <span className="text-xs text-ayush-muted block">Currently Active</span>
                <span className="font-heading text-2xl font-bold text-ayush-saffron">{activePlacementsCount}</span>
                <span className="text-[11px] text-ayush-muted block">Joined or In Progress</span>
              </div>

              <div className="p-3.5 rounded-xl border border-ayush-border/50 bg-ayush-surface-raised space-y-1">
                <span className="text-xs text-ayush-muted block">Completed Engagements</span>
                <span className="font-heading text-2xl font-bold text-emerald-700">{completedPlacementsCount}</span>
                <span className="text-[11px] text-ayush-muted block">Successfully certified</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function InstitutionDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Institution Dashboard...</div>}>
      <InstitutionDashboardContent />
    </Suspense>
  );
}

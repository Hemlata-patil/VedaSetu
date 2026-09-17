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
  ArrowUpRight,
  User,
  AlertCircle,
  Building2,
  Sparkles,
  BookOpen,
  Microscope,
  FileCheck2,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Faculty Dashboard — VEDA SETU",
  description: "Ayush faculty and academic mentorship portal",
};

async function FacultyDashboardContent() {
  const { user, profile } = await requireRole("faculty");
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  // If faculty has no institution affiliated
  if (!institutionId) {
    return (
      <DashboardShell
        userRole="faculty"
        userName={profile?.full_name || "Faculty Member"}
        userEmail={user.email || "faculty@institution.edu.in"}
        breadcrumbs={[{ label: "Ayush Portal", href: "/" }, { label: "Faculty Dashboard" }]}
      >
        <PageHeader
          eyebrow="Faculty Portal"
          eyebrowColor="saffron"
          title={`Welcome, ${profile?.full_name || "Faculty Member"}`}
          description="Faculty development, student case endorsement, and institutional mentorship."
        />

        <div className="p-6 rounded-xl bg-ayush-parchment/10 border border-ayush-parchment/30 mb-8">
          <div className="flex items-start gap-4">
            <span className="p-3 rounded-lg bg-ayush-parchment/20 text-ayush-saffron shrink-0">
              <AlertCircle className="w-6 h-6" />
            </span>
            <div className="space-y-2">
              <h3 className="text-base font-medium text-ayush-text">
                Institutional Affiliation Required
              </h3>
              <p className="text-sm text-ayush-text-muted leading-relaxed">
                Your profile is not currently affiliated with an academic institution. Institutional affiliation
                is required to monitor student competencies, view class cohorts, and initiate 1-on-1 mentorship.
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

  // 1. Fetch institution info
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, code, state")
    .eq("id", institutionId)
    .maybeSingle();

  // 2. Fetch institution students via ordinary client
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("role", "student")
    .eq("institution_id", institutionId);

  const studentList = students || [];
  const studentIds = studentList.map((s) => s.id);

  // 3. Fetch student competencies for these students
  const { data: rawComps } = studentIds.length > 0
    ? await supabase
        .from("student_competencies")
        .select("competency_id, student_id, proficiency_score, last_assessed_at, source, verified, competencies(id, name, category, description)")
        .in("student_id", studentIds)
    : { data: [] };

  // 4. Fetch mentorships for this faculty member
  const { data: mentorships } = await supabase
    .from("mentorships")
    .select("id, student_id, status, mentor_note, created_at, updated_at")
    .eq("faculty_id", user.id);

  const mentorshipList = mentorships || [];
  const activeMentorshipsCount = mentorshipList.filter((m) => m.status === "active").length;
  const pendingRequestsCount = mentorshipList.filter((m) => m.status === "pending").length;

  // Group competencies by student_id
  const compsByStudent = new Map<string, any[]>();
  (rawComps || []).forEach((row: any) => {
    if (!compsByStudent.has(row.student_id)) {
      compsByStudent.set(row.student_id, []);
    }
    compsByStudent.get(row.student_id)!.push(row);
  });

  // Calculate cohort assessment statistics
  let assessedStudentsCount = 0;
  let totalOverallScores = 0;

  studentList.forEach((st) => {
    const stComps = compsByStudent.get(st.id) || [];
    if (stComps.length > 0) {
      assessedStudentsCount += 1;
      const skillProfile = buildStudentSkillProfile(stComps);
      totalOverallScores += skillProfile.overallScore;
    }
  });

  const averageScore = assessedStudentsCount > 0
    ? Math.round(totalOverallScores / assessedStudentsCount)
    : null;

  // Recent mentees (active or completed only, pending handled in Inbox)
  const recentMenteeRecords = mentorshipList
    .filter((m) => m.status === "active" || m.status === "completed")
    .slice(0, 4)
    .map((m) => {
    const student = studentList.find((s) => s.id === m.student_id);
    const stComps = compsByStudent.get(m.student_id) || [];
    const skillProfile = stComps.length > 0 ? buildStudentSkillProfile(stComps) : null;

    return {
      ...m,
      studentName: student?.full_name || "Unknown Student",
      overallScore: skillProfile ? skillProfile.overallScore : null,
    };
  });

  // 5. Fetch FDP & Research Collaboration real data
  const { count: publishedOppCount } = await supabase
    .from("faculty_opportunities")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  const { data: myInterests } = await supabase
    .from("faculty_opportunity_interests")
    .select("id, status")
    .eq("faculty_id", user.id);

  const myInterestsCount = myInterests?.length || 0;
  const acceptedCollabsCount = (myInterests || []).filter((i) => i.status === "accepted").length;

  // 6. Fetch Student Placement Progress for institution cohort (only display if data exists)
  const { data: cohortPlacements } = studentIds.length > 0
    ? await supabase
        .from("internship_placements")
        .select(`
          id,
          status,
          progress_percent,
          applications!inner (
            student_id
          )
        `)
        .in("applications.student_id", studentIds)
    : { data: [] };

  const activeStudentPlacements = cohortPlacements || [];
  const activeStudentPlacementsCount = activeStudentPlacements.length;
  const inProgressPlacementsCount = activeStudentPlacements.filter(
    (p: any) => p.status === "in_progress" || p.status === "joined"
  ).length;

  return (
    <DashboardShell
      userRole="faculty"
      userName={profile?.full_name || "Faculty Mentor"}
      userEmail={user.email || "faculty@institution.edu.in"}
      breadcrumbs={[{ label: "Ayush Portal", href: "/" }, { label: "Faculty Dashboard" }]}
    >
      <PageHeader
        eyebrow="Academic Mentorship Portal"
        eyebrowColor="saffron"
        title={`Welcome, ${profile?.full_name || "Professor"}`}
        description={`Supervising student clinical competencies and mentorship at ${institution?.name || "Affiliated Institution"}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href="/faculty/students">
                <Users className="w-4 h-4" />
                <span>My Students</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="saffron" className="gap-2">
              <Link href="/faculty/mentorship">
                <GraduationCap className="w-4 h-4" />
                <span>Mentorship ({activeMentorshipsCount})</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Institution Banner */}
      <div className="flex items-center justify-between p-4 mb-6 rounded-lg bg-ayush-surface-raised border border-ayush-border/60">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-lg bg-ayush-herbal-subtle/30 text-ayush-herbal">
            <Building2 className="w-5 h-5" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-ayush-text">
              {institution?.name || "Affiliated Institution"}
            </h4>
            <p className="text-xs text-ayush-muted">
              {institution?.state || "India"} &bull; Code: {institution?.code || "INST"} &bull; NCISM / Ayush Affiliated
            </p>
          </div>
        </div>
        <Badge variant="herbal">Verified Campus</Badge>
      </div>

      {/* Pending Mentorship Requests Banner (if any) */}
      {pendingRequestsCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 mb-6 rounded-lg bg-ayush-saffron/10 border border-ayush-saffron/30">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-ayush-saffron/20 text-ayush-saffron shrink-0">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ayush-text">
                {pendingRequestsCount} Pending Mentorship {pendingRequestsCount === 1 ? "Request" : "Requests"}
              </p>
              <p className="text-xs text-ayush-muted">
                Institutional scholars are requesting your academic guidance and clinical case coaching.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="saffron" className="text-xs shrink-0 self-start sm:self-auto">
            <Link href="/faculty/mentorship">Review Requests</Link>
          </Button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card accent="saffron">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Campus Students</span>
              <Users className="w-4 h-4 text-ayush-saffron" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{studentList.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              Enrolled institutional scholars
            </p>
          </CardContent>
        </Card>

        <Card accent="green">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Students Assessed</span>
              <Award className="w-4 h-4 text-ayush-herbal" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{assessedStudentsCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              {studentList.length > 0
                ? `${Math.round((assessedStudentsCount / studentList.length) * 100)}% evaluated`
                : "No students registered"}
            </p>
          </CardContent>
        </Card>

        <Card accent="brown">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Average Skill Score</span>
              <Sparkles className="w-4 h-4 text-ayush-saffron" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {averageScore !== null ? `${averageScore}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              {averageScore !== null
                ? "Competency average"
                : "No assessment data"}
            </p>
          </CardContent>
        </Card>

        <Card accent="saffron">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ayush-muted">Mentorship Requests</span>
              <MessageSquare className="w-4 h-4 text-ayush-saffron" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{pendingRequestsCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ayush-muted">
              {pendingRequestsCount === 1 ? "1 request awaiting review" : `${pendingRequestsCount} requests awaiting review`}
            </p>
          </CardContent>
        </Card>

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
              Active student mentees guided
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Section: Quick Actions & Recent Mentees */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-ayush-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Mentees & Guidance Status</CardTitle>
                  <p className="text-xs text-ayush-muted mt-0.5">
                    Recent students assigned to your academic mentorship queue
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost" className="gap-1 text-xs">
                  <Link href="/faculty/mentorship">
                    <span>All Mentorships</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {recentMenteeRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-ayush-muted mb-3">
                    No active or historical mentorship records yet.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/faculty/students" className="gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>Browse Institution Students</span>
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMenteeRecords.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-ayush-surface-raised border border-ayush-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-ayush-surface flex items-center justify-center border border-ayush-border text-ayush-muted">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ayush-text">{m.studentName}</p>
                          <p className="text-xs text-ayush-muted truncate max-w-[280px]">
                            {m.mentor_note || "No notes entered."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {m.overallScore !== null ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ayush-surface border border-ayush-border">
                            {m.overallScore}%
                          </span>
                        ) : (
                          <Badge variant="parchment">Pending</Badge>
                        )}

                        <Badge variant={m.status === "active" ? "saffron" : "herbal"}>
                          {m.status === "active" ? "Active" : "Completed"}
                        </Badge>

                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/faculty/students/${m.student_id}`}>
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Guidance Overview */}
        <div className="space-y-6">
          <Card accent="green">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-ayush-herbal" />
                <span>Academic Supervision</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-ayush-text-muted leading-relaxed">
              <p>
                As an Ayush faculty mentor, you have direct access to your institution&apos;s student competency
                profiles.
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Review standardized competency benchmarks</li>
                <li>Identify clinical diagnostic & practical gaps</li>
                <li>Record 1-on-1 developmental notes</li>
                <li>Guide research methodology & evidence-based Ayush practice</li>
              </ul>
              <div className="pt-2">
                <Button asChild size="sm" variant="saffron" className="w-full">
                  <Link href="/faculty/students">View Institution Students</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* FDP & Research Summary Section */}
          <Card accent="saffron">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-ayush-saffron" />
                  <span>FDP & Research</span>
                </CardTitle>
                <Badge variant="saffron" className="text-[10px]">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-ayush-parchment/15 border border-ayush-parchment/30">
                  <div className="text-lg font-bold font-serif text-ayush-text">
                    {publishedOppCount || 0}
                  </div>
                  <div className="text-[10px] text-ayush-text-muted mt-0.5">Available</div>
                </div>

                <div className="p-2 rounded-lg bg-ayush-parchment/15 border border-ayush-parchment/30">
                  <div className="text-lg font-bold font-serif text-ayush-saffron">
                    {myInterestsCount}
                  </div>
                  <div className="text-[10px] text-ayush-text-muted mt-0.5">My Interests</div>
                </div>

                <div className="p-2 rounded-lg bg-ayush-parchment/15 border border-ayush-parchment/30">
                  <div className="text-lg font-bold font-serif text-emerald-600">
                    {acceptedCollabsCount}
                  </div>
                  <div className="text-[10px] text-ayush-text-muted mt-0.5">Accepted</div>
                </div>
              </div>

              <p className="text-ayush-text-muted leading-relaxed">
                Discover accredited Faculty Development Programs, joint clinical trials, and industry research collaborations.
              </p>

              <div className="pt-1 flex items-center gap-2">
                <Button asChild size="sm" variant="saffron" className="w-full text-xs">
                  <Link href="/faculty/collaboration">Browse Programs</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="w-full text-xs">
                  <Link href="/faculty/collaboration/interests">My Interests</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Student Placement Progress Card (Shown only if data exists) */}
          {activeStudentPlacementsCount > 0 && (
            <Card accent="green">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-ayush-herbal" />
                    <span>Student Placement Progress</span>
                  </CardTitle>
                  <Badge variant="herbal" className="text-[10px]">
                    {activeStudentPlacementsCount} Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ayush-parchment/15 border border-ayush-parchment/30">
                  <span className="text-ayush-text-muted">In Progress / Joined:</span>
                  <strong className="text-ayush-text font-serif text-sm">{inProgressPlacementsCount} Students</strong>
                </div>
                <p className="text-ayush-text-muted leading-relaxed">
                  Scholars from your institution are currently undergoing industry internships and career placements. View individual progress on student profiles.
                </p>
                <Button asChild size="sm" variant="outline" className="w-full text-xs">
                  <Link href="/faculty/students">View Enrolled Students</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function FacultyDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Faculty Dashboard...</div>}>
      <FacultyDashboardContent />
    </Suspense>
  );
}

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { buildStudentSkillProfile } from "@/lib/competencies";
import {
  Users,
  Award,
  ArrowUpRight,
  User,
  AlertCircle,
  Building2,
  Sparkles,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Cohort Students — VEDA SETU",
  description: "Collegiate student directory, skill assessment status, and mentorship oversight",
};

async function InstitutionStudentsContent() {
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
          { label: "Students" },
        ]}
      >
        <PageHeader
          eyebrow="Cohort Management"
          eyebrowColor="brown"
          title="Campus Students"
          description="Collegiate student directory and academic competency oversight."
        />

        <div className="p-6 rounded-xl bg-ayush-parchment/10 border border-ayush-parchment/30">
          <div className="flex items-start gap-4">
            <span className="p-3 rounded-lg bg-ayush-parchment/20 text-ayush-saffron shrink-0">
              <AlertCircle className="w-6 h-6" />
            </span>
            <div className="space-y-2">
              <h3 className="text-base font-medium text-ayush-text">
                Institutional Affiliation Required
              </h3>
              <p className="text-sm text-ayush-text-muted leading-relaxed">
                Your account is not linked to an institution record. Institutional affiliation is required to view cohort students.
              </p>
              <div className="pt-2">
                <Button asChild size="sm" variant="saffron">
                  <Link href="/profile">Update Profile</Link>
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

  // 2. Fetch students in this institution
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, program, year, department, created_at")
    .eq("role", "student")
    .eq("institution_id", institutionId)
    .order("full_name", { ascending: true });

  const studentList = students || [];
  const studentIds = studentList.map((s) => s.id);

  // 3. Fetch competencies for these students
  const { data: rawComps } = studentIds.length > 0
    ? await supabase
        .from("student_competencies")
        .select("competency_id, student_id, proficiency_score, last_assessed_at, source, verified, competencies(id, name, category, description)")
        .in("student_id", studentIds)
    : { data: [] };

  // 4. Fetch mentorships for these students (excluding mentor_note for privacy)
  const { data: mentorships } = studentIds.length > 0
    ? await supabase
        .from("mentorships")
        .select("id, student_id, faculty_id, status")
        .in("student_id", studentIds)
    : { data: [] };

  const mentorshipMap = new Map<string, { id: string; status: "active" | "completed" }>();
  (mentorships || []).forEach((m: any) => {
    mentorshipMap.set(m.student_id, m);
  });

  // 5. Fetch student application counts via privacy RPC
  const { data: appCountRows } = await supabase.rpc("get_institution_student_application_counts");
  const appCountMap = new Map<string, number>();
  (appCountRows || []).forEach((row: any) => {
    appCountMap.set(row.student_id, Number(row.application_count || 0));
  });

  // Group competencies by student_id
  const compsByStudent = new Map<string, any[]>();
  (rawComps || []).forEach((row: any) => {
    if (!compsByStudent.has(row.student_id)) {
      compsByStudent.set(row.student_id, []);
    }
    compsByStudent.get(row.student_id)!.push(row);
  });

  // Prepare student display rows
  const studentRows = studentList.map((st) => {
    const stComps = compsByStudent.get(st.id) || [];
    const isAssessed = stComps.length > 0;
    const skillProfile = isAssessed ? buildStudentSkillProfile(stComps) : null;
    const mentorship = mentorshipMap.get(st.id) || null;
    const applicationsCount = appCountMap.get(st.id) || 0;

    return {
      id: st.id,
      name: st.full_name || "Ayush Student",
      program: st.program || "BAMS",
      year: st.year ? `Year ${st.year}` : "Enrolled",
      department: st.department || "Ayurveda Samhita & Siddhanta",
      isAssessed,
      overallScore: skillProfile ? skillProfile.overallScore : null,
      priorityAreasCount: skillProfile ? skillProfile.priorityDevelopmentAreas.length : 0,
      mentorship,
      applicationsCount,
    };
  });

  const assessedCount = studentRows.filter((s) => s.isAssessed).length;

  return (
    <DashboardShell
      userRole="institution"
      userName={profile?.full_name || "Institution Administrator"}
      userEmail={user.email || "admin@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Institution Dashboard", href: "/institution/dashboard" },
        { label: "Students" },
      ]}
    >
      <PageHeader
        eyebrow="Collegiate Cohort"
        eyebrowColor="brown"
        title="Enrolled Students Directory"
        description={`Active student population affiliated with ${institution?.name || "Affiliated Institution"}.`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="herbal">
              {assessedCount} / {studentList.length} Assessed
            </Badge>
          </div>
        }
      />

      {/* Cohort Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 rounded-lg bg-ayush-surface-raised border border-ayush-border/60 text-xs">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-ayush-muted" />
          <span className="font-semibold text-ayush-text">{institution?.name}</span>
          <span className="text-ayush-muted">&bull; Code: {institution?.code || "INST"} &bull; {institution?.state}</span>
        </div>

        <div className="flex items-center gap-4 text-ayush-muted">
          <span>Total Students: <strong className="text-ayush-text">{studentList.length}</strong></span>
          <span>Assessed: <strong className="text-ayush-text">{assessedCount}</strong></span>
          <span>Pending: <strong className="text-ayush-text">{studentList.length - assessedCount}</strong></span>
        </div>
      </div>

      {studentRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Students Registered"
          description="There are currently no students registered under your institution."
        />
      ) : (
        <div className="space-y-3">
          {studentRows.map((student) => (
            <Card key={student.id} className="overflow-hidden hover:border-ayush-border transition-colors">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Student Identity & Academic Details */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ayush-surface-raised flex items-center justify-center text-ayush-muted border border-ayush-border shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-ayush-text">
                        {student.name}
                      </h4>
                      <p className="text-xs text-ayush-muted mt-0.5">
                        {student.program} &bull; {student.year} &bull; {student.department}
                      </p>
                    </div>
                  </div>

                  {/* Status, Scores & Privacy-Safe Counts */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Assessment Status & Score */}
                    {student.isAssessed ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="herbal">Assessed</Badge>
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-ayush-surface-raised border border-ayush-border text-xs">
                          <Award className="w-3.5 h-3.5 text-ayush-saffron" />
                          <span className="font-bold text-ayush-text">{student.overallScore}%</span>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="parchment">Assessment Pending</Badge>
                    )}

                    {/* Priority Development Areas */}
                    {student.isAssessed && student.priorityAreasCount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-ayush-muted">
                        <Sparkles className="w-3 h-3 text-ayush-saffron" />
                        <span>{student.priorityAreasCount} Priority {student.priorityAreasCount === 1 ? "Area" : "Areas"}</span>
                      </div>
                    )}

                    {/* Mentorship Status (No notes exposed) */}
                    {student.mentorship?.status === "active" && (
                      <Badge variant="saffron" dot>Active Mentee</Badge>
                    )}
                    {student.mentorship?.status === "completed" && (
                      <Badge variant="herbal">Mentorship Completed</Badge>
                    )}
                    {!student.mentorship && (
                      <Badge variant="default">Not Mentored</Badge>
                    )}

                    {/* Application Count */}
                    <div className="flex items-center gap-1 text-xs text-ayush-muted px-2 py-1 rounded bg-ayush-surface border border-ayush-border">
                      <Briefcase className="w-3.5 h-3.5 text-ayush-muted" />
                      <span>{student.applicationsCount} {student.applicationsCount === 1 ? "Application" : "Applications"}</span>
                    </div>

                    {/* Action */}
                    <Button asChild size="sm" variant="outline" className="gap-1 text-xs">
                      <Link href={`/institution/students/${student.id}`}>
                        <span>View Profile</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

export default function InstitutionStudentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Cohort Students...</div>}>
      <InstitutionStudentsContent />
    </Suspense>
  );
}

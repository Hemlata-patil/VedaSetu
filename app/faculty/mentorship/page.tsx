import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MentorshipList, MenteeItem } from "@/components/faculty/mentorship-list";
import { buildStudentSkillProfile } from "@/lib/competencies";
import { Suspense } from "react";

export const metadata = {
  title: "Mentorship Pipeline — VEDA SETU",
  description: "Manage 1-on-1 student academic mentorships and guidance notes",
};

async function FacultyMentorshipContent() {
  const { user, profile } = await requireRole("faculty");
  const supabase = await createClient();

  // 1. Fetch all mentorship records for this faculty member
  const { data: mentorships } = await supabase
    .from("mentorships")
    .select("id, student_id, status, mentor_note, request_note, created_at, updated_at")
    .eq("faculty_id", user.id)
    .order("updated_at", { ascending: false });

  const mentorshipList = mentorships || [];
  const studentIds = mentorshipList.map((m) => m.student_id);

  // 2. Fetch student profiles for these mentees & applicants
  const { data: students } = studentIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, institution_id, program, year, department")
        .in("id", studentIds)
    : { data: [] };

  const studentMap = new Map<string, any>();
  (students || []).forEach((s) => studentMap.set(s.id, s));

  // 3. Fetch competencies for these students
  const { data: rawComps } = studentIds.length > 0
    ? await supabase
        .from("student_competencies")
        .select("student_id, proficiency_score, competencies(id, name, category, description)")
        .in("student_id", studentIds)
    : { data: [] };

  const compsByStudent = new Map<string, any[]>();
  (rawComps || []).forEach((row: any) => {
    if (!compsByStudent.has(row.student_id)) {
      compsByStudent.set(row.student_id, []);
    }
    compsByStudent.get(row.student_id)!.push(row);
  });

  // Group into pendingRequests, activeMentees, and completedMentees
  const pendingRequests: any[] = [];
  const activeMentees: any[] = [];
  const completedMentees: any[] = [];

  for (const m of mentorshipList) {
    const st = studentMap.get(m.student_id);

    if (m.status === "pending") {
      pendingRequests.push({
        id: m.id,
        studentId: m.student_id,
        studentName: st?.full_name || "Ayush Student",
        program: st?.program || null,
        year: st?.year || null,
        department: st?.department || null,
        status: "pending",
        requestNote: m.request_note,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      });
    } else if (m.status === "active" || m.status === "completed") {
      const stComps = compsByStudent.get(m.student_id) || [];
      const skillProfile = stComps.length > 0 ? buildStudentSkillProfile(stComps) : null;

      const item = {
        id: m.id,
        studentId: m.student_id,
        studentName: st?.full_name || "Ayush Scholar",
        status: m.status as "active" | "completed",
        mentorNote: m.mentor_note,
        overallScore: skillProfile ? skillProfile.overallScore : null,
        priorityAreasCount: skillProfile ? skillProfile.priorityDevelopmentAreas.length : 0,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      };

      if (m.status === "active") {
        activeMentees.push(item);
      } else {
        completedMentees.push(item);
      }
    }
    // Rejected requests are not added to Active or Completed
  }

  return (
    <DashboardShell
      userRole="faculty"
      userName={profile?.full_name || "Faculty Mentor"}
      userEmail={user.email || "faculty@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Faculty Dashboard", href: "/faculty/dashboard" },
        { label: "Mentorship" },
      ]}
    >
      <PageHeader
        eyebrow="Academic Guidance"
        eyebrowColor="saffron"
        title="Mentorship Pipeline"
        description="Review incoming student mentorship requests, monitor active mentee clinical competencies, and document case feedback."
      />

      <MentorshipList
        pendingRequests={pendingRequests}
        activeMentees={activeMentees}
        completedMentees={completedMentees}
      />
    </DashboardShell>
  );
}

export default function FacultyMentorshipPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Mentorship Pipeline...</div>}>
      <FacultyMentorshipContent />
    </Suspense>
  );
}

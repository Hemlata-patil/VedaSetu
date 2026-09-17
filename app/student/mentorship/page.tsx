import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { StudentMentorshipClient, FacultyItem, MentorshipItem } from "./mentorship-client";
import { Suspense } from "react";

export const metadata = {
  title: "My Mentorship — VEDA SETU",
  description: "Connect with verified faculty mentors from your academic institution for clinical and competency guidance.",
};

async function StudentMentorshipContent() {
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  // 1. Fetch institution metadata if student is affiliated
  let institutionName: string | null = null;
  if (institutionId) {
    const { data: inst } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", institutionId)
      .maybeSingle();
    institutionName = inst?.name || null;
  }

  // 2. Fetch student's mentorship records (note: strictly omit mentor_note)
  const { data: rawMentorships } = await supabase
    .from("mentorships")
    .select("id, faculty_id, status, request_note, created_at, updated_at")
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false });

  const mentorshipList = rawMentorships || [];
  const facultyIdsInRecords = Array.from(new Set(mentorshipList.map((m) => m.faculty_id)));

  // 3. Fetch faculty profiles visible under RLS (same institution only)
  const { data: institutionFaculty } = institutionId
    ? await supabase
        .from("profiles")
        .select("id, full_name, department")
        .eq("role", "faculty")
        .order("full_name", { ascending: true })
    : { data: [] };

  // Map faculty info for easy lookup
  const facultyMap = new Map<string, { fullName: string; department: string | null }>();
  (institutionFaculty || []).forEach((f) => {
    facultyMap.set(f.id, {
      fullName: f.full_name || "Faculty Mentor",
      department: f.department || null,
    });
  });

  // Also ensure any faculty in past mentorship records are resolved
  const missingFacultyIds = facultyIdsInRecords.filter((id) => !facultyMap.has(id));
  if (missingFacultyIds.length > 0) {
    const { data: extraFaculty } = await supabase
      .from("profiles")
      .select("id, full_name, department")
      .in("id", missingFacultyIds);

    (extraFaculty || []).forEach((f) => {
      facultyMap.set(f.id, {
        fullName: f.full_name || "Faculty Mentor",
        department: f.department || null,
      });
    });
  }

  // 4. Format mentorship records
  const formattedMentorships: MentorshipItem[] = mentorshipList.map((m) => {
    const fac = facultyMap.get(m.faculty_id);
    return {
      id: m.id,
      facultyId: m.faculty_id,
      facultyName: fac?.fullName || "Faculty Mentor",
      facultyDepartment: fac?.department || null,
      status: m.status as "pending" | "active" | "completed" | "rejected",
      requestNote: m.request_note,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    };
  });

  const activeMentorship = formattedMentorships.find((m) => m.status === "active") || null;
  const pendingMentorship = formattedMentorships.find((m) => m.status === "pending") || null;
  const latestRejectedMentorship =
    formattedMentorships.find((m) => m.status === "rejected") || null;
  const completedMentorships = formattedMentorships.filter((m) => m.status === "completed");

  // 5. Format available faculty list
  const availableFaculty: FacultyItem[] = (institutionFaculty || []).map((f) => ({
    id: f.id,
    fullName: f.full_name || "Faculty Mentor",
    department: f.department || null,
    designation: f.department ? `${f.department} Faculty` : "Faculty Mentor",
  }));

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "student@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "My Mentorship" },
      ]}
    >
      <PageHeader
        eyebrow="Academic Supervision"
        eyebrowColor="green"
        title="My Mentorship"
        description="Connect with recognized institutional faculty mentors for 1-on-1 academic guidance, clinical case coaching, and competency development."
      />

      <StudentMentorshipClient
        hasInstitution={Boolean(institutionId)}
        institutionName={institutionName}
        activeMentorship={activeMentorship}
        pendingMentorship={pendingMentorship}
        latestRejectedMentorship={latestRejectedMentorship}
        completedMentorships={completedMentorships}
        availableFaculty={availableFaculty}
      />
    </DashboardShell>
  );
}

export default function StudentMentorshipPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Mentorship Portal...
          </div>
        </div>
      }
    >
      <StudentMentorshipContent />
    </Suspense>
  );
}

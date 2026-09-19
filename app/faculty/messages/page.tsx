import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FacultyMessagesClient } from "./faculty-messages-client";

export default async function FacultyMessagesPage() {
  const { user, profile } = await requireRole("faculty");
  const supabase = await createClient();

  // Fetch all active mentorships for this faculty member
  const { data: activeMentorships } = await supabase
    .from("mentorships")
    .select("student_id, student:profiles!student_id(id, full_name, avatar_url)")
    .eq("faculty_id", user.id)
    .eq("status", "active");

  const students = activeMentorships?.map(m => m.student).filter(Boolean) || [];

  return (
    <DashboardShell
      userRole="faculty"
      userName={profile.full_name || "Faculty Member"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Faculty Portal", href: "/faculty/dashboard" },
        { label: "Messages & Recommendations" },
      ]}
    >
      <FacultyMessagesClient currentUser={user} students={students} />
    </DashboardShell>
  );
}

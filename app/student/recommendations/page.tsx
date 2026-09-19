import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RecommendationList } from "./recommendation-list";

export default async function StudentRecommendationsPage() {
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  const { data: recommendations } = await supabase
    .from("mentor_recommendations")
    .select("*, mentor:profiles!mentor_id(full_name)")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell
      userRole="student"
      userName={profile.full_name || "Ayush Scholar"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Student Portal", href: "/student/dashboard" },
        { label: "Recommendations" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ayush-dark">Mentor Recommendations</h1>
          <p className="text-sm text-ayush-muted">Track and update the status of recommendations from your faculty mentor.</p>
        </div>

        <RecommendationList initialRecommendations={recommendations || []} />
      </div>
    </DashboardShell>
  );
}

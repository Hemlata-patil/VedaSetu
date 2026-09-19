import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  calculateOpportunitySkillMatch,
  OpportunityCompetencyRequirement,
} from "@/lib/opportunities";
import { Suspense } from "react";
import { OpportunitiesClient, SerializedOpportunity } from "./opportunities-client";

export const metadata = {
  title: "Industry Opportunities — VEDA SETU",
  description: "Explore clinical internships, projects, and apprenticeships matched with your Ayush skill profile",
};

async function StudentOpportunitiesContent() {
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 1. Fetch all PUBLISHED opportunities
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select(`
      id,
      title,
      description,
      opportunity_type,
      location,
      work_mode,
      eligibility,
      application_deadline,
      status,
      created_at,
      organizations (
        id,
        name
      ),
      opportunity_competencies (
        competency_id,
        required_score,
        weight,
        competencies (
          id,
          name,
          category
        )
      )
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // 2. Fetch student's assessed competencies from public.student_competencies
  const { data: studentComps } = await supabase
    .from("student_competencies")
    .select("competency_id, proficiency_score")
    .eq("student_id", user.id);

  const studentScoresMap = new Map<string, number>();
  let hasAssessedCompetencies = false;
  if (studentComps && studentComps.length > 0) {
    hasAssessedCompetencies = true;
    for (const sc of studentComps) {
      studentScoresMap.set(sc.competency_id, Number(sc.proficiency_score));
    }
  }

  // 3. Process opportunities with skill match calculation
  const serializedOpportunities: SerializedOpportunity[] = (opportunities || []).map((opp: any) => {
    const rawReqs = opp.opportunity_competencies || [];
    const requirements: OpportunityCompetencyRequirement[] = rawReqs
      .filter((r: any) => r.competencies)
      .map((r: any) => ({
        competencyId: r.competency_id,
        competencyName: r.competencies.name,
        category: r.competencies.category,
        requiredScore: Number(r.required_score) || 60,
        weight: Number(r.weight) || 1,
      }));

    const matchResult = calculateOpportunitySkillMatch(requirements, studentScoresMap);

    return {
      id: opp.id,
      title: opp.title,
      description: opp.description,
      opportunity_type: opp.opportunity_type,
      location: opp.location,
      work_mode: opp.work_mode,
      eligibility: opp.eligibility,
      application_deadline: opp.application_deadline,
      created_at: opp.created_at,
      organizations: opp.organizations,
      requirements,
      matchResult,
    };
  });

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "scholar@ayush.gov.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "Opportunities" },
      ]}
    >
      <PageHeader
        eyebrow="Industry & Academia"
        eyebrowColor="saffron"
        title="Industry Opportunities"
        description="Discover clinical internships, research collaborations, and entry-level roles with automated Skill Matching and Groq AI-powered personalized insights."
      />

      <OpportunitiesClient
        initialOpportunities={serializedOpportunities}
        hasAssessedCompetencies={hasAssessedCompetencies}
        studentDepartment={profile?.department}
      />
    </DashboardShell>
  );
}

export default function StudentOpportunitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Opportunities...
          </div>
        </div>
      }
    >
      <StudentOpportunitiesContent />
    </Suspense>
  );
}

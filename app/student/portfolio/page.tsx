import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PortfolioView } from "./portfolio-view";
import { Suspense } from "react";
import { Scroll, Award, Briefcase } from "lucide-react";

export const metadata = {
  title: "My Portfolio — VEDA SETU",
  description: "Your academic, competency and professional evidence in one place.",
};

async function StudentPortfolioContent() {
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 1. Fetch institution name if institution_id is present
  let institutionName: string | null = null;
  if (profile?.institution_id) {
    const { data: inst } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", profile.institution_id)
      .maybeSingle();
    if (inst?.name) {
      institutionName = inst.name;
    }
  }

  // 2. Fetch standardized skills / competencies
  const { data: rawCompetencies } = await supabase
    .from("student_competencies")
    .select(`
      competency_id,
      proficiency_score,
      verified,
      competencies (
        id,
        name,
        category
      )
    `)
    .eq("student_id", user.id);

  const formattedCompetencies: Array<{
    id: string;
    name: string;
    category: "academic_domain" | "clinical_practical" | "research" | "professional";
    score: number;
    verified: boolean;
  }> = [];

  for (const item of (rawCompetencies || [])) {
    const comp: any = Array.isArray(item.competencies)
      ? item.competencies[0]
      : item.competencies;
    if (comp && comp.id && comp.name) {
      formattedCompetencies.push({
        id: comp.id,
        name: comp.name,
        category: comp.category as any,
        score: Math.round(Number(item.proficiency_score) || 0),
        verified: Boolean(item.verified),
      });
    }
  }

  // 3. Fetch student's portfolio items
  const { data: rawPortfolioItems, error: portfolioError } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const portfolioItems = portfolioError ? [] : (rawPortfolioItems || []);

  // 3.1 Fetch student's portfolio documents metadata
  const { data: rawDocuments, error: docsError } = await supabase
    .from("portfolio_documents")
    .select("*")
    .eq("student_id", user.id);

  const portfolioDocuments = docsError ? [] : (rawDocuments || []);

  // 4. Fetch placement records
  const { data: rawPlacements } = await supabase
    .from("internship_placements")
    .select(`
      id,
      engagement_type,
      status,
      start_date,
      expected_end_date,
      actual_end_date,
      outcome,
      applications!inner (
        student_id,
        opportunities!inner (
          id,
          title,
          organizations (
            name
          )
        )
      )
    `)
    .eq("applications.student_id", user.id)
    .order("created_at", { ascending: false });

  const formattedPlacements = (rawPlacements || []).map((plc: any) => {
    const app = Array.isArray(plc.applications)
      ? plc.applications[0]
      : plc.applications;
    const opp = Array.isArray(app?.opportunities)
      ? app?.opportunities[0]
      : app?.opportunities;
    const org = Array.isArray(opp?.organizations)
      ? opp?.organizations[0]
      : opp?.organizations;

    return {
      id: plc.id,
      opportunityTitle: opp?.title || "Industry Placement",
      organizationName: org?.name || null,
      engagementType: plc.engagement_type || "internship",
      status: plc.status,
      startDate: plc.start_date,
      completionDate: plc.actual_end_date || plc.expected_end_date,
      outcome: plc.outcome,
    };
  });

  // 5. Fetch meaningful collaboration records from faculty_opportunity_interests
  // Does NOT infer faculty collaboration from applications + opportunities
  const { data: rawInterests, error: interestsError } = await supabase
    .from("faculty_opportunity_interests")
    .select(`
      id,
      status,
      created_at,
      faculty_opportunities!inner (
        id,
        title,
        opportunity_type,
        provider_name,
        organizations (
          name
        )
      )
    `)
    .eq("faculty_id", user.id)
    .in("status", ["accepted", "under_review"])
    .order("created_at", { ascending: false });

  const formattedCollaborations = (interestsError ? [] : (rawInterests || [])).map((item: any) => {
    const opp = Array.isArray(item.faculty_opportunities)
      ? item.faculty_opportunities[0]
      : item.faculty_opportunities;
    const org = Array.isArray(opp?.organizations)
      ? opp?.organizations[0]
      : opp?.organizations;

    return {
      id: item.id,
      title: opp?.title || "Faculty / Industry Collaboration",
      type: opp?.opportunity_type || "collaboration",
      organizationName: opp?.provider_name || org?.name || null,
      status: item.status,
    };
  });

  const profileData = {
    id: user.id,
    full_name: profile?.full_name || "Ayush Scholar",
    email: user.email || "",
    role: profile?.role || "student",
    phone: profile?.phone || null,
    program: profile?.program || null,
    year: profile?.year || null,
    department: profile?.department || null,
    institution_name: institutionName,
  };

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "student@ayush.local"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "My Portfolio" },
      ]}
    >
      <PageHeader
        eyebrow="Digital Portfolio"
        eyebrowColor="green"
        title="My Portfolio"
        description="Your academic, competency and professional evidence in one place."
      />

      <PortfolioView
        profile={profileData}
        competencies={formattedCompetencies}
        portfolioItems={portfolioItems}
        documents={portfolioDocuments}
        placements={formattedPlacements}
        collaborations={formattedCollaborations}
      />
    </DashboardShell>
  );
}

export default function StudentPortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Student Portfolio...
          </div>
        </div>
      }
    >
      <StudentPortfolioContent />
    </Suspense>
  );
}

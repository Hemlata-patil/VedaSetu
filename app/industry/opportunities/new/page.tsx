import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Suspense } from "react";
import { NewOpportunityForm } from "./new-opportunity-form";

export const metadata = {
  title: "Post Opportunity — VEDA SETU",
  description: "Create a new clinical internship, project, or apprenticeship with required competencies",
};

async function NewOpportunityPageContent() {
  const { user, profile } = await requireRole("industry");
  const supabase = await createClient();

  // Load all active platform competencies from Supabase
  const { data: competencies } = await supabase
    .from("competencies")
    .select("id, name, category, description")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  // Check if organization details are available
  let orgName = "";
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) {
      orgName = org.name;
    }
  }

  return (
    <DashboardShell
      userRole="industry"
      userName={profile?.full_name || "Industry Partner"}
      userEmail={user.email || "partner@ayushindustry.org"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Industry Dashboard", href: "/industry/dashboard" },
        { label: "Opportunities", href: "/industry/opportunities" },
        { label: "New Opportunity" },
      ]}
    >
      <PageHeader
        eyebrow="Industry Postings"
        eyebrowColor="green"
        title="Post New Opportunity"
        description="Specify requirements, deadlines, and required Ayush competencies for automated student skill matching."
      />

      <div className="max-w-4xl">
        <NewOpportunityForm
          competencies={competencies || []}
          defaultOrgName={orgName}
        />
      </div>
    </DashboardShell>
  );
}

export default function NewOpportunityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Form...
          </div>
        </div>
      }
    >
      <NewOpportunityPageContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OpportunityModerationTable, OpportunityRow } from "./opportunity-table";
import { FileCheck2 } from "lucide-react";

async function OpportunitiesContent() {
  const { profile } = await requireSuperAdmin();
  const adminClient = createAdminClient();

  const { data: opportunities, error } = await adminClient
    .from("opportunities")
    .select(`
      id,
      title,
      description,
      opportunity_type,
      status,
      location,
      application_deadline,
      created_at,
      organizations (name),
      profiles (full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <DashboardShell
        userRole="super_admin"
        userName={profile.full_name || "Super Admin"}
        userEmail={profile.email}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Opportunities" },
        ]}
      >
        <div className="p-6 rounded-xl border border-ayush-terracotta/20 bg-ayush-terracotta/10 text-ayush-terracotta text-xs">
          Failed to load opportunities: {error.message}
        </div>
      </DashboardShell>
    );
  }

  const opportunityRows: OpportunityRow[] = (opportunities || []).map((opp: any) => ({
    id: opp.id,
    title: opp.title,
    description: opp.description,
    opportunity_type: opp.opportunity_type,
    status: opp.status,
    location: opp.location,
    stipend: null,
    application_deadline: opp.application_deadline,
    created_at: opp.created_at,
    organizationName: opp.organizations?.name || opp.organizations?.[0]?.name || null,
    creatorName: opp.profiles?.full_name || opp.profiles?.[0]?.full_name || null,
    creatorEmail: opp.profiles?.email || opp.profiles?.[0]?.email || null,
  }));

  return (
    <DashboardShell
      userRole="super_admin"
      userName={profile.full_name || "Super Admin"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Super Admin", href: "/super-admin/dashboard" },
        { label: "Opportunities" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ayush-border/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-ayush-saffron" />
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-ayush-dark">
                Opportunity Moderation
              </h1>
            </div>
            <p className="text-xs text-ayush-muted mt-1">
              Oversee and moderate listings across AYUSH internships, clinical projects, research fellowships, and jobs
            </p>
          </div>
        </div>

        <OpportunityModerationTable initialOpportunities={opportunityRows} />
      </div>
    </DashboardShell>
  );
}

export default function SuperAdminOpportunitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-xl text-ayush-dark">
            Loading Opportunity Moderation...
          </div>
        </div>
      }
    >
      <OpportunitiesContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { IndustryTable, OrganizationRow } from "./industry-table";
import { Briefcase } from "lucide-react";

async function IndustriesContent() {
  const { profile } = await requireSuperAdmin();
  const adminClient = createAdminClient();

  // Fetch all organizations
  const { data: organizations, error } = await adminClient
    .from("organizations")
    .select("id, name, organization_type, location, created_at, verification_status")
    .order("name", { ascending: true });

  if (error) {
    return (
      <DashboardShell
        userRole="super_admin"
        userName={profile.full_name || "Super Admin"}
        userEmail={profile.email}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Industries" },
        ]}
      >
        <div className="p-6 rounded-xl border border-ayush-terracotta/20 bg-ayush-terracotta/10 text-ayush-terracotta text-xs">
          Failed to load organizations: {error.message}
        </div>
      </DashboardShell>
    );
  }

  // Fetch opportunities count per organization
  const { data: opportunities } = await adminClient
    .from("opportunities")
    .select("organization_id")
    .not("organization_id", "is", null);

  const oppCountMap: Record<string, number> = {};
  (opportunities || []).forEach((o) => {
    if (!o.organization_id) return;
    oppCountMap[o.organization_id] = (oppCountMap[o.organization_id] || 0) + 1;
  });

  const organizationRows: OrganizationRow[] = (organizations || []).map((org: any) => ({
    id: org.id,
    name: org.name,
    organization_type: org.organization_type || "Pharmaceutical / Healthcare",
    location: org.location || "India",
    verification_status: org.verification_status || "approved",
    created_at: org.created_at,
    opportunityCount: oppCountMap[org.id] || 0,
  }));

  return (
    <DashboardShell
      userRole="super_admin"
      userName={profile.full_name || "Super Admin"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Super Admin", href: "/super-admin/dashboard" },
        { label: "Industries" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ayush-border/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-ayush-green" />
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-ayush-dark">
                Industry & Partner Governance
              </h1>
            </div>
            <p className="text-xs text-ayush-muted mt-1">
              Review, approve, and moderate verified pharmaceutical manufacturers, clinical research institutes, and wellness partners
            </p>
          </div>
        </div>

        <IndustryTable initialOrganizations={organizationRows} />
      </div>
    </DashboardShell>
  );
}

export default function SuperAdminIndustriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-xl text-ayush-dark">
            Loading Industry Governance...
          </div>
        </div>
      }
    >
      <IndustriesContent />
    </Suspense>
  );
}

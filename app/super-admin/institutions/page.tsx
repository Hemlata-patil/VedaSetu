import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InstitutionTable, InstitutionRow } from "./institution-table";
import { Building2 } from "lucide-react";

async function InstitutionsContent() {
  const { profile } = await requireSuperAdmin();
  const adminClient = createAdminClient();

  // Fetch all institutions
  const { data: institutions, error } = await adminClient
    .from("institutions")
    .select("id, name, code, created_at, category, location, verification_status")
    .order("name", { ascending: true });

  if (error) {
    return (
      <DashboardShell
        userRole="super_admin"
        userName={profile.full_name || "Super Admin"}
        userEmail={profile.email}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Institutions" },
        ]}
      >
        <div className="p-6 rounded-xl border border-ayush-terracotta/20 bg-ayush-terracotta/10 text-ayush-terracotta text-xs">
          Failed to load institutions: {error.message}
        </div>
      </DashboardShell>
    );
  }

  // Fetch student & faculty counts per institution from profiles
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("institution_id, role")
    .not("institution_id", "is", null);

  const studentCountMap: Record<string, number> = {};
  const facultyCountMap: Record<string, number> = {};

  (profiles || []).forEach((p) => {
    if (!p.institution_id) return;
    if (p.role === "student") {
      studentCountMap[p.institution_id] = (studentCountMap[p.institution_id] || 0) + 1;
    } else if (p.role === "faculty") {
      facultyCountMap[p.institution_id] = (facultyCountMap[p.institution_id] || 0) + 1;
    }
  });

  const institutionRows: InstitutionRow[] = (institutions || []).map((inst: any) => ({
    id: inst.id,
    name: inst.name,
    code: inst.code,
    category: inst.category || "Ayurveda College",
    location: inst.location || "India",
    verification_status: inst.verification_status || "approved",
    created_at: inst.created_at,
    studentCount: studentCountMap[inst.id] || 0,
    facultyCount: facultyCountMap[inst.id] || 0,
  }));

  return (
    <DashboardShell
      userRole="super_admin"
      userName={profile.full_name || "Super Admin"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Super Admin", href: "/super-admin/dashboard" },
        { label: "Institutions" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ayush-border/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-ayush-brown" />
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-ayush-dark">
                Institution Governance
              </h1>
            </div>
            <p className="text-xs text-ayush-muted mt-1">
              Review, approve, and oversee affiliated Ayurveda academic institutions and universities
            </p>
          </div>
        </div>

        <InstitutionTable initialInstitutions={institutionRows} />
      </div>
    </DashboardShell>
  );
}

export default function SuperAdminInstitutionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-xl text-ayush-dark">
            Loading Institution Governance...
          </div>
        </div>
      }
    >
      <InstitutionsContent />
    </Suspense>
  );
}

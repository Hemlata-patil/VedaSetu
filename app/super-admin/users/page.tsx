import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UserTable, UserProfileRow } from "./user-table";
import { Users } from "lucide-react";

async function UsersContent() {
  const { user, profile } = await requireSuperAdmin();
  const adminClient = createAdminClient();

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      phone,
      department,
      program,
      created_at,
      institutions:institution_id(name),
      organizations:organization_id(name)
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
          { label: "Users" },
        ]}
      >
        <div className="p-6 rounded-xl border border-ayush-terracotta/20 bg-ayush-terracotta/10 text-ayush-terracotta text-xs">
          Failed to load users: {error.message}
        </div>
      </DashboardShell>
    );
  }

  const userRows: UserProfileRow[] = (profiles || []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    phone: p.phone,
    department: p.department,
    program: p.program,
    created_at: p.created_at,
    institutionName: p.institutions?.name || null,
    organizationName: p.organizations?.name || null,
  }));

  return (
    <DashboardShell
      userRole="super_admin"
      userName={profile.full_name || "Super Admin"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Super Admin", href: "/super-admin/dashboard" },
        { label: "Users" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ayush-border/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-ayush-terracotta" />
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-ayush-dark">
                User & Role Governance
              </h1>
            </div>
            <p className="text-xs text-ayush-muted mt-1">
              Oversee platform accounts, monitor role integrity, and safely manage academic assignments
            </p>
          </div>
        </div>

        <UserTable initialUsers={userRows} currentUserId={user.id} />
      </div>
    </DashboardShell>
  );
}

export default function SuperAdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-xl text-ayush-dark">
            Loading User Governance...
          </div>
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  );
}

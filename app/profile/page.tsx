import { requireAuth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile-form";
import { UserRole } from "@/lib/auth";

import { Suspense } from "react";

export const metadata = {
  title: "My Profile — VEDA SETU",
  description: "View and manage your academic and professional Ayush profile",
};

async function ProfilePageContent() {
  const { user, profile } = await requireAuth();

  const role: UserRole = profile?.role || "student";
  const dashboardPath = role === "super_admin" ? "/super-admin/dashboard" : `/${role}/dashboard`;

  return (
    <DashboardShell
      userRole={role}
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "user@ayush.edu.in"}
      breadcrumbs={[
        { label: "Dashboard", href: dashboardPath },
        { label: "My Profile" },
      ]}
    >
      <PageHeader
        eyebrow="Account & Identity"
        eyebrowColor={role === "student" ? "green" : role === "faculty" ? "saffron" : "brown"}
        title="Personal Profile & Academic Coordinates"
        description="Review your account authorization, manage personal contact info, and update your academic specialization."
      />

      {profile && <ProfileForm profile={profile} email={user.email!} />}
    </DashboardShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Profile...
          </div>
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}

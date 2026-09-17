import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { FacultyDirectory, FacultyItem } from "./faculty-directory";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Faculty Directory — VEDA SETU",
  description: "Academic faculty roster, mentor assignments, and departmental oversight",
};

async function InstitutionFacultyContent() {
  const { user, profile } = await requireRole("institution");
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  if (!institutionId) {
    return (
      <DashboardShell
        userRole="institution"
        userName={profile?.full_name || "Institution Administrator"}
        userEmail={user.email || "admin@institution.edu.in"}
        breadcrumbs={[
          { label: "Ayush Portal", href: "/" },
          { label: "Institution Dashboard", href: "/institution/dashboard" },
          { label: "Faculty" },
        ]}
      >
        <PageHeader
          eyebrow="Campus Governance"
          eyebrowColor="brown"
          title="Faculty Management"
          description="Collegiate faculty roster and mentor onboarding."
        />

        <div className="p-6 rounded-xl bg-ayush-parchment/10 border border-ayush-parchment/30">
          <div className="flex items-start gap-4">
            <span className="p-3 rounded-lg bg-ayush-parchment/20 text-ayush-saffron shrink-0">
              <AlertCircle className="w-6 h-6" />
            </span>
            <div className="space-y-2">
              <h3 className="text-base font-medium text-ayush-text">
                Institutional Linkage Required
              </h3>
              <p className="text-sm text-ayush-text-muted leading-relaxed">
                Your administrative profile is not currently linked to an academic institution record.
                Institutional affiliation is required to manage campus faculty accounts.
              </p>
              <div className="pt-2">
                <Button asChild size="sm" variant="saffron">
                  <Link href="/profile">Update Profile & Affiliation</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // 1. Fetch institution details
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, code, state, location")
    .eq("id", institutionId)
    .maybeSingle();

  // 2. Fetch all faculty strictly scoped to this institution
  const { data: facultyRows, error: facultyError } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, designation, created_at")
    .eq("role", "faculty")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  if (facultyError) {
    return (
      <DashboardShell
        userRole="institution"
        userName={profile?.full_name || "Institution Administrator"}
        userEmail={user.email || "admin@institution.edu.in"}
        breadcrumbs={[
          { label: "Ayush Portal", href: "/" },
          { label: "Institution Dashboard", href: "/institution/dashboard" },
          { label: "Faculty" },
        ]}
      >
        <div className="p-6 rounded-xl border border-ayush-terracotta/20 bg-ayush-terracotta/10 text-ayush-terracotta text-xs">
          Failed to load campus faculty: {facultyError.message}
        </div>
      </DashboardShell>
    );
  }

  const facultyList: FacultyItem[] = (facultyRows || []).map((f: any) => ({
    id: f.id,
    full_name: f.full_name || "Faculty Member",
    designation: f.designation || null,
    department: f.department || null,
    email: f.email || "",
    created_at: f.created_at || new Date().toISOString(),
  }));

  return (
    <DashboardShell
      userRole="institution"
      userName={profile?.full_name || "Institution Administrator"}
      userEmail={user.email || "admin@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Institution Dashboard", href: "/institution/dashboard" },
        { label: "Faculty" },
      ]}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Campus Governance"
          eyebrowColor="brown"
          title="Faculty Management"
          description={`Oversee collegiate educators, clinical mentors, and academic faculty for ${institution?.name || "Affiliated Campus"}.`}
        />

        <FacultyDirectory
          initialFaculty={facultyList}
          institutionName={institution?.name || "Affiliated Institution"}
          institutionCode={institution?.code || null}
        />
      </div>
    </DashboardShell>
  );
}

export default function InstitutionFacultyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-xl text-ayush-dark">
            Loading Campus Faculty...
          </div>
        </div>
      }
    >
      <InstitutionFacultyContent />
    </Suspense>
  );
}

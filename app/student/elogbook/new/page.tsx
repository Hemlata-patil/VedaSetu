import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { CaseForm } from "@/components/elogbook/case-form";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";

export const metadata = {
  title: "New Clinical Case Entry — VEDA SETU",
  description: "Record a new de-identified clinical learning case in the e-Logbook",
};

async function NewCasePageContent() {
  const { user, profile } = await requireRole("student");

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "scholar@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "Clinical e-Logbook", href: "/student/elogbook" },
        { label: "New Case Entry" },
      ]}
    >
      <PageHeader
        eyebrow="Clinical Encounter Documentation"
        eyebrowColor="green"
        title="Record Clinical Learning Case"
        description="Document patient presentation, Ashtavidha Pariksha findings, standardized NAMASTE terminology, and learning reflections."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="saffron" dot>
              Demo Entry
            </Badge>
          </div>
        }
      />

      <div className="mb-10">
        <CaseForm />
      </div>
    </DashboardShell>
  );
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Case Entry Form...</div>}>
      <NewCasePageContent />
    </Suspense>
  );
}

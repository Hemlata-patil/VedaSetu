import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { CaseList } from "@/components/elogbook/case-list";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";

export const metadata = {
  title: "Clinical e-Logbook (Demo) — VEDA SETU",
  description: "Standardized Ayush clinical learning case records & NAMASTE terminology integration for students",
};

async function ELogbookPageContent() {
  const { user, profile } = await requireRole("student");

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "scholar@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "Clinical e-Logbook (Demo)" },
      ]}
    >
      <PageHeader
        eyebrow="Clinical Education & Skill Evidence"
        eyebrowColor="green"
        title="NAMASTE Clinical e-Logbook"
        description="Record standardized clinical case encounters, attach NAMASTE & ICD-11 terminology codes, and receive faculty review and competency sign-offs."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="herbal" dot>
              Phase 3 Prototype
            </Badge>
          </div>
        }
      />

      <div className="mb-10">
        <CaseList />
      </div>
    </DashboardShell>
  );
}

export default function StudentELogbookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Clinical e-Logbook...</div>}>
      <ELogbookPageContent />
    </Suspense>
  );
}

import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TerminologySearch } from "@/components/elogbook/terminology-search";
import sampleCatalog from "@/data/terminology/namaste-sample-catalog.json";
import { SampleTerminologyItem } from "@/lib/terminology/types";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";

export const metadata = {
  title: "Terminology Explorer (Demo) — VEDA SETU",
  description: "Phase 1 NAMASTE terminology search prototype for Ayush scholars",
};

async function TerminologyPageContent() {
  const { user, profile } = await requireRole("student");

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "scholar@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "Terminology Explorer (Demo)" },
      ]}
    >
      <PageHeader
        eyebrow="NAMASTE e-Logbook Prototype"
        eyebrowColor="green"
        title="Ayush Terminology Explorer"
        description="Search standardized Ayurveda diseases, symptoms, diagnostic examinations, and therapeutic procedures for clinical case documentation."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="herbal" dot>
              Phase 1 Prototype
            </Badge>
          </div>
        }
      />

      <div className="mb-10">
        <TerminologySearch
          initialCatalog={sampleCatalog as SampleTerminologyItem[]}
        />
      </div>
    </DashboardShell>
  );
}

export default function StudentTerminologyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Terminology Explorer...</div>}>
      <TerminologyPageContent />
    </Suspense>
  );
}

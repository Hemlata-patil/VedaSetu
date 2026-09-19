"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { CaseDetail } from "@/components/elogbook/case-detail";
import { fetchCaseLogByIdAction } from "@/app/student/elogbook/actions";
import { ClinicalCaseLog } from "@/lib/elogbook/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, FileQuestion, Database } from "lucide-react";

// Inner component: uses useParams — must be inside Suspense at the page boundary
function CaseDetailContent() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.id as string;
  const [caseLog, setCaseLog] = React.useState<ClinicalCaseLog | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = React.useState(false);

  React.useEffect(() => {
    async function loadCase() {
      if (!caseId) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetchCaseLogByIdAction(caseId);
        if (res.isTableMissing) {
          setIsTableMissing(true);
          setErrorMessage(res.error || "Supabase database tables not yet created.");
        } else if (!res.success || !res.data) {
          setErrorMessage(res.error || "Clinical case log not found.");
        } else {
          setCaseLog(res.data);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load case log.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCase();
  }, [caseId]);

  if (isLoading) {
    return (
      <DashboardShell
        userRole="student"
        breadcrumbs={[
          { label: "Ayush Portal", href: "/" },
          { label: "Student Dashboard", href: "/student/dashboard" },
          { label: "Clinical e-Logbook", href: "/student/elogbook" },
          { label: "Case Details" },
        ]}
      >
        <div className="flex items-center justify-center p-12 text-ayush-muted">
          <Clock className="w-5 h-5 animate-spin mr-2" />
          Loading case details...
        </div>
      </DashboardShell>
    );
  }

  if (!caseLog) {
    return (
      <DashboardShell
        userRole="student"
        breadcrumbs={[
          { label: "Ayush Portal", href: "/" },
          { label: "Student Dashboard", href: "/student/dashboard" },
          { label: "Clinical e-Logbook", href: "/student/elogbook" },
          { label: "Case Not Found" },
        ]}
      >
        <div className="text-center py-16 px-4 bg-ayush-card border border-ayush-border/80 rounded-2xl max-w-xl mx-auto my-8">
          {isTableMissing ? (
            <Database className="w-12 h-12 text-ayush-terracotta mx-auto mb-3" />
          ) : (
            <FileQuestion className="w-12 h-12 text-ayush-muted/40 mx-auto mb-3" />
          )}
          <h3 className="text-lg font-bold text-ayush-dark font-heading">
            {isTableMissing ? "Supabase Tables Not Ready" : "Case Record Not Found"}
          </h3>
          <p className="text-xs text-ayush-muted mt-1 mb-6">
            {errorMessage ||
              "The requested clinical case log could not be found or you do not have permission to view it."}
          </p>
          <Link href="/student/elogbook">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Return to e-Logbook
            </Button>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      userRole="student"
      userName={caseLog.student_name}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "Clinical e-Logbook", href: "/student/elogbook" },
        { label: caseLog.case_reference_token },
      ]}
    >
      <PageHeader
        eyebrow="Clinical Case Documentation"
        eyebrowColor="green"
        title={caseLog.provisional_diagnosis}
        description={`Synthetic Token: ${caseLog.case_reference_token} • Department of ${caseLog.department} • Encounter Date: ${caseLog.encounter_date}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="herbal" dot>
              Case Log Record
            </Badge>
          </div>
        }
      />

      <div className="mb-10">
        <CaseDetail caseLog={caseLog} />
      </div>
    </DashboardShell>
  );
}

// Page export: wraps CaseDetailContent in Suspense so useParams() doesn't block
// static prerendering (Next.js 16 requirement)
export default function CaseDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Case Details...
          </div>
        </div>
      }
    >
      <CaseDetailContent />
    </React.Suspense>
  );
}

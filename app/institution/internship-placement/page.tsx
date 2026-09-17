import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award,
  Building2,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Internship & Placement Outcomes — Institutional Oversight",
  description: "Aggregated placement and internship tracking across enrolled student cohorts",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeVariant: "saffron" | "herbal" | "secondary" | "destructive" | "default" | "outline" }
> = {
  selected: { label: "Selected", badgeVariant: "saffron" },
  offer_accepted: { label: "Offer Accepted", badgeVariant: "herbal" },
  joined: { label: "Joined", badgeVariant: "herbal" },
  in_progress: { label: "In Progress", badgeVariant: "saffron" },
  completed: { label: "Completed", badgeVariant: "herbal" },
  withdrawn: { label: "Withdrawn", badgeVariant: "destructive" },
};

async function InstitutionPlacementContent() {
  const { user, profile } = await requireRole("institution");
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  // 1. Fetch placement records where application student belongs to this institution
  // RLS enforces: s.institution_id = public.get_auth_institution_id()
  const { data: placements } = await supabase
    .from("internship_placements")
    .select(`
      id,
      engagement_type,
      status,
      start_date,
      expected_end_date,
      actual_end_date,
      progress_percent,
      supervisor_name,
      outcome,
      created_at,
      applications!inner (
        id,
        opportunity_id,
        student_id,
        applied_at,
        profiles!applications_student_id_fkey (
          id,
          full_name,
          program,
          year,
          institution_id
        ),
        opportunities!inner (
          id,
          title,
          opportunity_type,
          organizations (
            id,
            name,
            organization_type
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  const placementList = (placements || []).map((p: any) => {
    const app = p.applications;
    const student = Array.isArray(app?.profiles) ? app?.profiles[0] : app?.profiles;
    const opp = Array.isArray(app?.opportunities) ? app?.opportunities[0] : app?.opportunities;
    const org = Array.isArray(opp?.organizations) ? opp?.organizations[0] : opp?.organizations;

    return {
      ...p,
      student,
      opportunity: opp,
      organization: org,
    };
  });

  // Calculate institutional aggregate metrics
  const totalSelected = placementList.filter((p) => p.status === "selected").length;
  const totalJoined = placementList.filter((p) => ["joined", "in_progress", "completed"].includes(p.status)).length;
  const totalInProgress = placementList.filter((p) => p.status === "in_progress").length;
  const totalCompleted = placementList.filter((p) => p.status === "completed").length;

  return (
    <DashboardShell
      userRole="institution"
      userName={profile?.full_name || "Institution Admin"}
      userEmail={user.email || ""}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Institution Dashboard", href: "/institution/dashboard" },
        { label: "Internship & Placement" },
      ]}
    >
      <PageHeader
        eyebrow="Institutional Outcomes"
        eyebrowColor="saffron"
        title="Internship & Placement Oversight"
        description="Comprehensive tracking of enterprise selections, internship tenures, and career placements across your campus student body."
      />

      {/* Aggregate Metric Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card accent="saffron">
          <CardHeader className="p-4 pb-2">
            <span className="text-xs text-ayush-muted">Selections Initiated</span>
            <CardTitle className="text-2xl font-bold">{totalSelected}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-ayush-muted">
            Candidates with pending or active onboarding
          </CardContent>
        </Card>

        <Card accent="green">
          <CardHeader className="p-4 pb-2">
            <span className="text-xs text-ayush-muted">Joined Workforce</span>
            <CardTitle className="text-2xl font-bold text-ayush-green">{totalJoined}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-ayush-muted">
            Students who successfully commenced engagement
          </CardContent>
        </Card>

        <Card accent="brown">
          <CardHeader className="p-4 pb-2">
            <span className="text-xs text-ayush-muted">Currently In Progress</span>
            <CardTitle className="text-2xl font-bold text-ayush-saffron">{totalInProgress}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-ayush-muted">
            Actively undergoing training or projects
          </CardContent>
        </Card>

        <Card accent="green">
          <CardHeader className="p-4 pb-2">
            <span className="text-xs text-ayush-muted">Completed Engagements</span>
            <CardTitle className="text-2xl font-bold text-emerald-700">{totalCompleted}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-ayush-muted">
            Full-term completion & career outcomes
          </CardContent>
        </Card>
      </div>

      {placementList.length === 0 ? (
        <Card className="border-dashed border-ayush-parchment/40 bg-ayush-parchment/5">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-ayush-saffron/10 text-ayush-saffron mx-auto flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-serif font-bold text-ayush-text">
                No Placement Records Logged
              </h3>
              <p className="text-sm text-ayush-text-muted max-w-md mx-auto">
                When industry partners select students from your institution and start engagement tracking, institutional progress and outcomes will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-ayush-parchment/30 bg-card">
          <CardHeader className="p-6 pb-4 border-b border-ayush-parchment/20">
            <CardTitle className="text-base font-serif font-bold text-ayush-text">
              Institutional Placement Records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-ayush-parchment/20">
            {placementList.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status] || {
                label: item.status,
                badgeVariant: "secondary" as const,
              };
              const progress = Number(item.progress_percent) || 0;

              return (
                <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-serif font-bold text-ayush-text">
                        {item.student?.full_name || "Scholar"}
                      </h4>
                      {item.student?.program && (
                        <span className="text-xs text-ayush-text-muted">
                          ({item.student.program} {item.student.year ? `Year ${item.student.year}` : ""})
                        </span>
                      )}
                      <Badge variant={statusCfg.badgeVariant} className="text-xs capitalize">
                        {statusCfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs uppercase font-mono">
                        {item.engagement_type}
                      </Badge>
                    </div>

                    <p className="text-xs text-ayush-text-muted">
                      Opportunity: <strong className="text-ayush-text">{item.opportunity?.title}</strong>
                      {item.organization?.name && ` • ${item.organization.name}`}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-ayush-text-muted pt-1">
                      {item.start_date && (
                        <span>Start: {new Date(item.start_date).toLocaleDateString()}</span>
                      )}
                      {item.expected_end_date && (
                        <span>Expected End: {new Date(item.expected_end_date).toLocaleDateString()}</span>
                      )}
                      {item.supervisor_name && (
                        <span>Supervisor: {item.supervisor_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-ayush-text">{progress}% Progress</span>
                    <div className="w-24 bg-ayush-parchment/20 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-ayush-saffron h-full rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}

export default function InstitutionPlacementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Placement Oversight...</div>}>
      <InstitutionPlacementContent />
    </Suspense>
  );
}

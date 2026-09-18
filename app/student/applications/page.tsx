import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  calculateOpportunitySkillMatch,
  OpportunityCompetencyRequirement,
} from "@/lib/opportunities";
import { APPLICATION_STATUS_CONFIG, ApplicationStatus } from "@/lib/applications";
import {
  Briefcase,
  Building2,
  Calendar,
  Award,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { WithdrawButton } from "./withdraw-button";

export const metadata = {
  title: "My Applications — VEDA SETU",
  description: "Track your submitted applications, recruitment review status, and skill matches",
};

async function StudentApplicationsContent() {
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 1. Fetch student's applications with opportunity details
  const { data: applications } = await supabase
    .from("applications")
    .select(`
      id,
      status,
      applied_at,
      cover_note,
      opportunities!inner (
        id,
        title,
        opportunity_type,
        location,
        work_mode,
        status,
        organizations (
          name
        ),
        opportunity_competencies (
          competency_id,
          required_score,
          weight,
          competencies (
            id,
            name,
            category
          )
        )
      )
    `)
    .eq("student_id", user.id)
    .neq("status", "withdrawn")
    .order("applied_at", { ascending: false });

  // 2. Fetch student's assessed competencies to calculate real-time Skill Match
  const { data: studentComps } = await supabase
    .from("student_competencies")
    .select("competency_id, proficiency_score")
    .eq("student_id", user.id);

  const studentScoresMap = new Map<string, number>();
  if (studentComps) {
    for (const sc of studentComps) {
      studentScoresMap.set(sc.competency_id, Number(sc.proficiency_score));
    }
  }

  // 3. Process each application with its calculated match
  const processedApplications = (applications || []).map((app: any) => {
    const opp = app.opportunities;
    const rawReqs = opp?.opportunity_competencies || [];
    const requirements: OpportunityCompetencyRequirement[] = rawReqs
      .filter((r: any) => r.competencies)
      .map((r: any) => ({
        competencyId: r.competency_id,
        competencyName: r.competencies.name,
        category: r.competencies.category,
        requiredScore: Number(r.required_score) || 60,
        weight: Number(r.weight) || 1,
      }));

    const matchResult = calculateOpportunitySkillMatch(requirements, studentScoresMap);

    return {
      ...app,
      opportunity: opp,
      requirements,
      matchResult,
    };
  });

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "scholar@ayush.gov.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Student Dashboard", href: "/student/dashboard" },
        { label: "My Applications" },
      ]}
    >
      <PageHeader
        eyebrow="Recruitment & Training"
        eyebrowColor="saffron"
        title="My Applications"
        description="Track the status of your clinical internships, research fellowships, and project applications."
      />

      {processedApplications.length > 0 ? (
        <div className="space-y-4">
          {processedApplications.map((app) => {
            const opp = app.opportunity;
            const orgName = opp.organizations?.name || "Ayush Partner Organization";
            const statusConfig =
              APPLICATION_STATUS_CONFIG[app.status as ApplicationStatus] || {
                label: app.status,
                variant: "parchment",
                description: "",
              };
            const matchPercentage = app.matchResult.skillMatchPercentage;
            const canWithdraw = app.status === "applied" || app.status === "under_review";
            const formattedDate = new Date(app.applied_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <Card key={app.id} className="p-6 hover:border-ayush-border/90 transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left info area */}
                  <div className="space-y-2.5 flex-1">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={statusConfig.variant as any}
                          className="capitalize text-xs font-semibold"
                        >
                          {statusConfig.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {opp.opportunity_type?.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-ayush-muted flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-ayush-brown/60" />
                          {orgName}
                        </span>
                      </div>
                      <h3 className="font-heading text-xl font-bold text-ayush-dark pt-0.5">
                        {opp.title}
                      </h3>
                    </div>

                    {app.cover_note && (
                      <p className="text-xs text-ayush-muted bg-ayush-sand/30 p-2.5 rounded-lg border border-ayush-border/50 line-clamp-2 italic">
                        &ldquo;{app.cover_note}&rdquo;
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-ayush-muted pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-ayush-brown/70" />
                        Applied on {formattedDate}
                      </span>
                      {opp.location && (
                        <span>
                          {opp.location} ({opp.work_mode || "onsite"})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Match & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between lg:justify-center gap-4 shrink-0 lg:min-w-[200px] border-t lg:border-t-0 pt-4 lg:pt-0 border-ayush-border/60">
                    <div className="text-left lg:text-right">
                      {app.matchResult.hasRequirements && matchPercentage !== null ? (
                        <div className="space-y-1">
                          <div className="flex items-baseline lg:justify-end gap-1.5">
                            <span className="text-xs font-semibold text-ayush-muted uppercase tracking-wider">
                              Skill Match:
                            </span>
                            <span className="font-heading text-xl font-bold text-ayush-herbal">
                              {matchPercentage}%
                            </span>
                          </div>
                          <div className="w-28 lg:ml-auto">
                            <Progress value={matchPercentage} className="h-1.5" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-ayush-muted">Skills not specified</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {canWithdraw && <WithdrawButton applicationId={app.id} />}
                      <Button asChild size="sm" variant="default" className="gap-1.5 text-xs">
                        <Link href={`/student/opportunities/${opp.id}`}>
                          <span>View Opportunity</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ayush-sand/80 text-ayush-brown border border-ayush-border/70">
              <Briefcase className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-heading text-xl font-semibold text-ayush-dark">
                No Applications Yet
              </h3>
              <p className="text-xs text-ayush-muted leading-relaxed">
                Explore published industry opportunities and submit your profile to match with top clinical institutions and enterprises.
              </p>
            </div>
            <Button asChild size="sm" variant="default">
              <Link href="/student/opportunities">Browse Opportunities</Link>
            </Button>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}

export default function StudentApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Applications...
          </div>
        </div>
      }
    >
      <StudentApplicationsContent />
    </Suspense>
  );
}

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  PlusCircle,
  Clock,
  Calendar,
  Users,
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CreateOpportunityModal } from "./create-modal";
import { ManageStatusButtons } from "./status-buttons";

export const metadata = {
  title: "Manage Created Opportunities — Faculty Collaboration",
};

async function ManageOpportunitiesContent() {
  // Allow faculty, institution, or industry accounts
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, institution_id, organization_id")
    .eq("id", user.id)
    .single();

  // Fetch opportunities owned by this user (created_by = auth.uid())
  const { data: opportunities, error } = await supabase
    .from("faculty_opportunities")
    .select(`
      id,
      title,
      description,
      opportunity_type,
      provider_name,
      mode,
      start_date,
      end_date,
      application_deadline,
      status,
      created_at
    `)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const oppList = opportunities || [];

  // Fetch interest count per opportunity
  const oppIds = oppList.map((o) => o.id);
  const countMap = new Map<string, number>();

  if (oppIds.length > 0) {
    const { data: interests } = await supabase
      .from("faculty_opportunity_interests")
      .select("opportunity_id")
      .in("opportunity_id", oppIds);

    (interests || []).forEach((item) => {
      countMap.set(item.opportunity_id, (countMap.get(item.opportunity_id) || 0) + 1);
    });
  }

  return (
    <DashboardShell
      userRole={profile?.role as any || "faculty"}
      userName={profile?.full_name || "Account"}
      userEmail={user.email || ""}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Faculty Dashboard", href: "/faculty/dashboard" },
        { label: "FDP & Research", href: "/faculty/collaboration" },
        { label: "Manage Created Opportunities" },
      ]}
    >
      <PageHeader
        eyebrow="Opportunity Ownership"
        eyebrowColor="saffron"
        title="Manage Opportunities"
        description="Programs, workshops, or research initiatives created and authored by your account."
        actions={
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/faculty/collaboration" className="flex items-center gap-1.5 text-xs">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Opportunities</span>
              </Link>
            </Button>
            <CreateOpportunityModal profile={profile} />
          </div>
        }
      />

      {oppList.length === 0 ? (
        <Card className="border-dashed border-ayush-parchment/40 bg-ayush-parchment/5">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-ayush-saffron/10 text-ayush-saffron mx-auto flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-serif font-bold text-ayush-text">No Created Opportunities</h3>
              <p className="text-sm text-ayush-text-muted max-w-md mx-auto">
                You have not created any FDP, workshop, or research opportunities yet. Click below to draft and publish a new program.
              </p>
            </div>
            <CreateOpportunityModal profile={profile} triggerText="Create Your First Opportunity" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {oppList.map((opp) => {
            const applicantCount = countMap.get(opp.id) || 0;

            return (
              <Card key={opp.id} className="border-ayush-parchment/30 bg-card hover:border-ayush-saffron/30 transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="saffron" className="text-[10px] uppercase font-semibold">
                          {opp.opportunity_type.replace("_", " ")}
                        </Badge>
                        <Badge
                          variant={
                            opp.status === "published"
                              ? "herbal"
                              : opp.status === "closed"
                              ? "outline"
                              : opp.status === "archived"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs capitalize font-medium"
                        >
                          {opp.status}
                        </Badge>
                        {opp.mode && (
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {opp.mode}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-base font-serif font-bold text-ayush-text">
                        {opp.title}
                      </h3>

                      <p className="text-xs text-ayush-text-muted line-clamp-2">
                        {opp.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ayush-text-muted pt-1">
                        {opp.application_deadline && (
                          <span>Deadline: {new Date(opp.application_deadline).toLocaleDateString()}</span>
                        )}
                        <span>Created: {new Date(opp.created_at).toLocaleDateString()}</span>
                        <span className="font-medium text-ayush-teal">
                          {applicantCount} Faculty {applicantCount === 1 ? "Interest" : "Interests"} Received
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-end lg:self-center shrink-0">
                      <ManageStatusButtons opportunityId={opp.id} currentStatus={opp.status} />

                      <Button asChild size="sm" variant="outline" className="text-xs">
                        <Link href={`/faculty/collaboration/${opp.id}/interests`} className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>Review Interests ({applicantCount})</span>
                        </Link>
                      </Button>

                      <Button asChild size="sm" variant="ghost" className="text-xs">
                        <Link href={`/faculty/collaboration/${opp.id}`}>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

export default function ManageOpportunitiesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Managed Opportunities...</div>}>
      <ManageOpportunitiesContent />
    </Suspense>
  );
}

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  MapPin,
  ExternalLink,
  Users,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OpportunityInterestForm } from "./interest-form";

export const metadata = {
  title: "Opportunity Details — Faculty Collaboration",
};

interface OpportunityDetailProps {
  params: Promise<{ id: string }>;
}

async function OpportunityDetailContent({ params }: OpportunityDetailProps) {
  const { user, profile } = await requireRole("faculty");
  const { id } = await params;

  const supabase = await createClient();

  // Fetch opportunity details
  const { data: opp, error } = await supabase
    .from("faculty_opportunities")
    .select(`
      id,
      title,
      description,
      opportunity_type,
      provider_name,
      location,
      mode,
      start_date,
      end_date,
      application_deadline,
      external_url,
      status,
      created_at,
      created_by,
      organizations(id, name, organization_type, location)
    `)
    .eq("id", id)
    .single();

  if (error || !opp) {
    notFound();
  }

  const isOwner = opp.created_by === user.id;

  // Check if current faculty member has already expressed interest
  const { data: existingInterest } = await supabase
    .from("faculty_opportunity_interests")
    .select("id, status, message, created_at, updated_at")
    .eq("opportunity_id", id)
    .eq("faculty_id", user.id)
    .maybeSingle();

  // If owner, fetch count of applicants
  let interestCount = 0;
  if (isOwner) {
    const { count } = await supabase
      .from("faculty_opportunity_interests")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", id);
    interestCount = count || 0;
  }

  return (
    <DashboardShell
      userRole="faculty"
      userName={profile?.full_name || "Faculty Member"}
      userEmail={user.email || "faculty@institution.edu.in"}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "Faculty Dashboard", href: "/faculty/dashboard" },
        { label: "FDP & Research", href: "/faculty/collaboration" },
        { label: opp.title },
      ]}
    >
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="text-xs text-ayush-text-muted hover:text-ayush-text">
          <Link href="/faculty/collaboration" className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Opportunities</span>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-ayush-parchment/30 bg-card">
            <CardHeader className="p-6 pb-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="saffron" className="text-xs capitalize tracking-wide">
                  {opp.opportunity_type.replace("_", " ")}
                </Badge>
                {opp.mode && (
                  <Badge variant="outline" className="text-xs uppercase font-mono">
                    {opp.mode}
                  </Badge>
                )}
                {opp.status !== "published" && (
                  <Badge variant="destructive" className="text-xs capitalize">
                    {opp.status}
                  </Badge>
                )}
                {isOwner && (
                  <Badge variant="outline" className="text-xs border-ayush-gold text-ayush-gold">
                    Created by You
                  </Badge>
                )}
              </div>

              <CardTitle className="text-2xl font-serif font-bold text-ayush-text leading-tight">
                {opp.title}
              </CardTitle>

              {(() => {
                const org = Array.isArray(opp.organizations) ? opp.organizations[0] : opp.organizations;
                return (opp.provider_name || org) ? (
                  <div className="flex items-center gap-2 text-sm text-ayush-teal font-medium mt-2">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{opp.provider_name || org?.name}</span>
                    {org?.organization_type && (
                      <span className="text-ayush-text-muted font-normal">({org.organization_type})</span>
                    )}
                  </div>
                ) : null;
              })()}
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ayush-text-muted mb-2">
                  Program Overview & Scope
                </h4>
                <p className="text-sm text-ayush-text leading-relaxed whitespace-pre-line">
                  {opp.description}
                </p>
              </div>

              {opp.external_url && (
                <div className="pt-4 border-t border-ayush-parchment/20">
                  <a
                    href={opp.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-ayush-saffron hover:underline font-medium"
                  >
                    <span>Visit External Project / Accreditation Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner Quick Action Bar */}
          {isOwner && (
            <Card className="border-ayush-gold/30 bg-ayush-gold/5">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-ayush-text">Opportunity Management</h4>
                  <p className="text-xs text-ayush-text-muted">
                    You have received {interestCount} faculty interest submissions for this program.
                  </p>
                </div>
                <Button asChild variant="saffron" size="sm">
                  <Link href={`/faculty/collaboration/${opp.id}/interests`} className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>Review Interests ({interestCount})</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Panel */}
        <div className="space-y-6">
          {/* Key Facts */}
          <Card className="border-ayush-parchment/30 bg-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-ayush-text-muted">
                Key Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3.5 text-xs">
              {opp.location && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-ayush-saffron shrink-0 mt-0.5" />
                  <div>
                    <div className="text-ayush-text-muted">Location</div>
                    <div className="text-ayush-text font-medium">{opp.location}</div>
                  </div>
                </div>
              )}

              {(opp.start_date || opp.end_date) && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-ayush-teal shrink-0 mt-0.5" />
                  <div>
                    <div className="text-ayush-text-muted">Program Timeline</div>
                    <div className="text-ayush-text font-medium">
                      {opp.start_date ? new Date(opp.start_date).toLocaleDateString() : "TBD"}
                      {opp.end_date ? ` — ${new Date(opp.end_date).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                </div>
              )}

              {opp.application_deadline && (
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-ayush-text-muted">Application Deadline</div>
                    <div className="text-ayush-text font-medium text-rose-600">
                      {new Date(opp.application_deadline).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Express Interest Card */}
          {!isOwner && (
            <Card className="border-ayush-parchment/30 bg-card">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-serif font-bold text-ayush-text">
                  Collaboration Interest
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                {existingInterest ? (
                  <div className="p-4 rounded-lg bg-ayush-parchment/15 border border-ayush-parchment/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ayush-text-muted">Your Status:</span>
                      <Badge
                        variant={
                          existingInterest.status === "accepted"
                            ? "herbal"
                            : existingInterest.status === "rejected"
                            ? "destructive"
                            : existingInterest.status === "withdrawn"
                            ? "outline"
                            : "saffron"
                        }
                        className="text-xs capitalize"
                      >
                        {existingInterest.status.replace("_", " ")}
                      </Badge>
                    </div>

                    {existingInterest.message && (
                      <div className="text-xs text-ayush-text-muted italic border-l-2 border-ayush-saffron/40 pl-2">
                        "{existingInterest.message}"
                      </div>
                    )}

                    <div className="text-[11px] text-ayush-text-muted">
                      Submitted on: {new Date(existingInterest.created_at).toLocaleDateString()}
                    </div>

                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm" className="w-full text-xs">
                        <Link href="/faculty/collaboration/interests">View in My Interests</Link>
                      </Button>
                    </div>
                  </div>
                ) : opp.status !== "published" ? (
                  <p className="text-xs text-ayush-text-muted">
                    This program is currently not accepting expressions of interest.
                  </p>
                ) : (
                  <OpportunityInterestForm opportunityId={opp.id} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function FacultyOpportunityDetailPage(props: OpportunityDetailProps) {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Opportunity Details...</div>}>
      <OpportunityDetailContent {...props} />
    </Suspense>
  );
}

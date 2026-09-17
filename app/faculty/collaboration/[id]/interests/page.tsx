import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  Calendar,
  ArrowLeft,
  GraduationCap,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ReviewInterestActions } from "./review-actions";

export const metadata = {
  title: "Review Faculty Interests — Opportunity Management",
};

interface InterestsReviewProps {
  params: Promise<{ id: string }>;
}

async function OpportunityInterestsReviewContent({ params }: InterestsReviewProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // 1. Fetch opportunity and verify ownership (created_by = auth.uid())
  const { data: opp, error: oppErr } = await supabase
    .from("faculty_opportunities")
    .select("id, title, opportunity_type, status, created_by, created_at")
    .eq("id", id)
    .single();

  if (oppErr || !opp) {
    notFound();
  }

  if (opp.created_by !== user.id) {
    // Non-owner cannot view submitted interests for another person's opportunity
    return (
      <DashboardShell
        userRole="faculty"
        userName="Account"
        userEmail={user.email || ""}
        breadcrumbs={[
          { label: "Ayush Portal", href: "/" },
          { label: "FDP & Research", href: "/faculty/collaboration" },
          { label: "Access Denied" },
        ]}
      >
        <Card className="border-rose-200 bg-rose-50/50 p-8 text-center mt-6">
          <h3 className="text-base font-bold text-rose-800">Unauthorized Access</h3>
          <p className="text-xs text-rose-600 mt-1">
            Only the opportunity creator may review expressions of interest submitted to this program.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/faculty/collaboration">Return to Collaboration Hub</Link>
          </Button>
        </Card>
      </DashboardShell>
    );
  }

  // 2. Fetch applicant interests and applicant profile information
  const { data: interests, error: intErr } = await supabase
    .from("faculty_opportunity_interests")
    .select(`
      id,
      status,
      message,
      created_at,
      updated_at,
      profiles (
        id,
        full_name,
        email,
        department,
        program,
        institutions (
          id,
          name,
          code
        )
      )
    `)
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });

  const applicantList = (interests || []).map((item: any) => ({
    ...item,
    faculty: item.profiles,
    institution: item.profiles?.institutions,
  }));

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  return (
    <DashboardShell
      userRole={userProfile?.role as any || "faculty"}
      userName={userProfile?.full_name || "Account"}
      userEmail={user.email || ""}
      breadcrumbs={[
        { label: "Ayush Portal", href: "/" },
        { label: "FDP & Research", href: "/faculty/collaboration" },
        { label: opp.title, href: `/faculty/collaboration/${opp.id}` },
        { label: "Review Interests" },
      ]}
    >
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="text-xs text-ayush-text-muted hover:text-ayush-text">
          <Link href={`/faculty/collaboration/${opp.id}`} className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Opportunity</span>
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Applicant Review"
        eyebrowColor="saffron"
        title="Faculty Interest Submissions"
        description={`Review expressions of interest for "${opp.title}". Update candidate progress from review to accepted or rejected.`}
        actions={
          <Badge variant="outline" className="text-xs">
            {applicantList.length} Total Submissions
          </Badge>
        }
      />

      {applicantList.length === 0 ? (
        <Card className="border-dashed border-ayush-parchment/40 bg-ayush-parchment/5">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-ayush-saffron/10 text-ayush-saffron mx-auto flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-serif font-bold text-ayush-text">No Applicants Yet</h3>
              <p className="text-sm text-ayush-text-muted max-w-md mx-auto">
                No faculty members have expressed interest in this opportunity yet. Once faculty apply, their credentials and research statements will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applicantList.map((app) => (
            <Card key={app.id} className="border-ayush-parchment/30 bg-card hover:border-ayush-saffron/30 transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-serif font-bold text-ayush-text">
                        {app.faculty?.full_name || "Faculty Applicant"}
                      </h3>
                      <Badge
                        variant={
                          app.status === "accepted"
                            ? "herbal"
                            : app.status === "rejected"
                            ? "destructive"
                            : app.status === "withdrawn"
                            ? "outline"
                            : "saffron"
                        }
                        className="text-xs capitalize"
                      >
                        {app.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-ayush-text-muted">
                      {app.institution?.name && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-ayush-teal shrink-0" />
                          <span>{app.institution.name}</span>
                        </div>
                      )}
                      {app.faculty?.department && (
                        <div className="flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-ayush-saffron shrink-0" />
                          <span>{app.faculty.department}</span>
                        </div>
                      )}
                      {app.faculty?.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-ayush-text-muted shrink-0" />
                          <span>{app.faculty.email}</span>
                        </div>
                      )}
                    </div>

                    {app.message && (
                      <div className="text-xs text-ayush-text-muted bg-ayush-parchment/15 border border-ayush-parchment/30 rounded p-3 mt-2">
                        <span className="font-semibold text-ayush-text block mb-0.5">Faculty Statement:</span>
                        "{app.message}"
                      </div>
                    )}

                    <div className="text-[11px] text-ayush-text-muted pt-1">
                      Submitted: {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Owner Status Management Workflow */}
                  <div className="shrink-0 self-end lg:self-center">
                    <ReviewInterestActions
                      interestId={app.id}
                      currentStatus={app.status}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

export default function OpportunityInterestsReviewPage(props: InterestsReviewProps) {
  return (
    <Suspense fallback={<div className="p-8 text-ayush-muted">Loading Interests Review...</div>}>
      <OpportunityInterestsReviewContent {...props} />
    </Suspense>
  );
}

"use server";

import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { OpportunityType, OpportunityStatus, WorkMode } from "@/lib/opportunities";

export interface CreateOpportunityParams {
  title: string;
  description: string;
  opportunityType: OpportunityType;
  location?: string;
  workMode?: WorkMode;
  eligibility?: string;
  applicationDeadline?: string;
  organizationName?: string;
  status: "draft" | "published";
  requiredCompetencies: Array<{
    competencyId: string;
    requiredScore: number;
    weight?: number;
  }>;
}

export async function createOpportunity(params: CreateOpportunityParams) {
  const { user, profile } = await requireRole("industry");
  const supabase = await createClient();
  const adminClient = createAdminClient();

  let organizationId = profile?.organization_id || null;

  // If user has no organization linked yet and entered an organization name, resolve/create it
  if (!organizationId && params.organizationName && params.organizationName.trim()) {
    const orgName = params.organizationName.trim();
    // Check if organization exists by name
    const { data: existingOrg } = await adminClient
      .from("organizations")
      .select("id")
      .ilike("name", orgName)
      .limit(1)
      .maybeSingle();

    if (existingOrg) {
      organizationId = existingOrg.id;
    } else {
      const { data: newOrg } = await adminClient
        .from("organizations")
        .insert({
          name: orgName,
          organization_type: "Ayush Industry Partner",
          location: params.location || null,
        })
        .select("id")
        .single();

      if (newOrg) {
        organizationId = newOrg.id;
      }
    }

    // Attach to profile for future postings
    if (organizationId) {
      await adminClient
        .from("profiles")
        .update({ organization_id: organizationId })
        .eq("id", user.id);
    }
  }

  // 1. Insert Opportunity
  const { data: newOpp, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      created_by: user.id,
      organization_id: organizationId,
      title: params.title.trim(),
      description: params.description.trim(),
      opportunity_type: params.opportunityType,
      location: params.location?.trim() || null,
      work_mode: params.workMode || null,
      eligibility: params.eligibility?.trim() || null,
      application_deadline: params.applicationDeadline || null,
      status: params.status,
    })
    .select("id")
    .single();

  if (oppErr || !newOpp) {
    throw new Error(`Failed to create opportunity: ${oppErr?.message || "Unknown error"}`);
  }

  // 2. Insert Required Competencies (if any)
  if (params.requiredCompetencies && params.requiredCompetencies.length > 0) {
    const compRows = params.requiredCompetencies.map((rc) => ({
      opportunity_id: newOpp.id,
      competency_id: rc.competencyId,
      required_score: Math.min(100, Math.max(0, Number(rc.requiredScore) || 60)),
      weight: rc.weight && rc.weight > 0 ? Number(rc.weight) : 1,
    }));

    const { error: compErr } = await supabase
      .from("opportunity_competencies")
      .insert(compRows);

    if (compErr) {
      throw new Error(`Failed to attach required competencies: ${compErr.message}`);
    }
  }

  revalidatePath("/industry/dashboard");
  revalidatePath("/industry/opportunities");
  revalidatePath("/student/opportunities");

  return { success: true, opportunityId: newOpp.id };
}

export async function updateOpportunityStatus(
  opportunityId: string,
  newStatus: OpportunityStatus
) {
  const { user } = await requireRole("industry");
  const supabase = await createClient();

  const { error } = await supabase
    .from("opportunities")
    .update({ status: newStatus })
    .eq("id", opportunityId)
    .eq("created_by", user.id);

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  revalidatePath("/industry/dashboard");
  revalidatePath("/industry/opportunities");
  revalidatePath("/student/opportunities");

  return { success: true };
}

export async function deleteOpportunity(opportunityId: string) {
  const { user } = await requireRole("industry");
  const supabase = await createClient();

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", opportunityId)
    .eq("created_by", user.id);

  if (error) {
    throw new Error(`Failed to delete opportunity: ${error.message}`);
  }

  revalidatePath("/industry/dashboard");
  revalidatePath("/industry/opportunities");
  revalidatePath("/student/opportunities");

  return { success: true };
}

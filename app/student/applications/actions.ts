"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidStatusTransition, ApplicationStatus } from "@/lib/applications";

export interface ApplyToOpportunityParams {
  opportunityId: string;
  coverNote?: string;
}

export async function applyToOpportunity(params: ApplyToOpportunityParams) {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  if (!params.opportunityId) {
    throw new Error("Opportunity ID is required.");
  }

  // 1. Verify opportunity exists and is published
  const { data: opportunity, error: oppErr } = await supabase
    .from("opportunities")
    .select("id, status")
    .eq("id", params.opportunityId)
    .eq("status", "published")
    .maybeSingle();

  if (oppErr || !opportunity) {
    throw new Error("This opportunity is not active or published.");
  }

  // 2. Check for duplicate application
  const { data: existingApp } = await supabase
    .from("applications")
    .select("id, status")
    .eq("opportunity_id", params.opportunityId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existingApp) {
    throw new Error("You have already applied to this opportunity.");
  }

  // 3. Insert application record
  const { data: newApp, error: insertErr } = await supabase
    .from("applications")
    .insert({
      opportunity_id: params.opportunityId,
      student_id: user.id,
      cover_note: params.coverNote?.trim() || null,
      status: "applied",
    })
    .select("id")
    .single();

  if (insertErr || !newApp) {
    throw new Error(`Failed to submit application: ${insertErr?.message || "Unknown error"}`);
  }

  revalidatePath(`/student/opportunities/${params.opportunityId}`);
  revalidatePath("/student/opportunities");
  revalidatePath("/student/applications");
  revalidatePath("/industry/applications");

  return { success: true, applicationId: newApp.id };
}

export async function withdrawApplication(applicationId: string) {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  // 1. Fetch current application
  const { data: application, error: fetchErr } = await supabase
    .from("applications")
    .select("id, status, opportunity_id, student_id")
    .eq("id", applicationId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (fetchErr || !application) {
    throw new Error("Application not found or unauthorized.");
  }

  // 2. Validate transition
  const validation = isValidStatusTransition(
    application.status as ApplicationStatus,
    "withdrawn",
    "student"
  );
  if (!validation.allowed) {
    throw new Error(validation.reason || "Application cannot be withdrawn.");
  }

  // 3. Perform update (also enforced at database trigger level)
  const { error: updateErr } = await supabase
    .from("applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("student_id", user.id);

  if (updateErr) {
    throw new Error(`Failed to withdraw application: ${updateErr.message}`);
  }

  revalidatePath(`/student/opportunities/${application.opportunity_id}`);
  revalidatePath("/student/applications");
  revalidatePath("/industry/applications");

  return { success: true };
}

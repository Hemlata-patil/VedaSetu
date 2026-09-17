"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidStatusTransition, ApplicationStatus } from "@/lib/applications";

export interface UpdateCandidateStatusParams {
  applicationId: string;
  newStatus: ApplicationStatus;
}

export async function updateCandidateStatus(params: UpdateCandidateStatusParams) {
  const { user } = await requireRole("industry");
  const supabase = await createClient();

  if (!params.applicationId || !params.newStatus) {
    throw new Error("Application ID and target status are required.");
  }

  // 1. Fetch application and verify ownership via opportunity
  const { data: application, error: fetchErr } = await supabase
    .from("applications")
    .select(`
      id,
      status,
      opportunity_id,
      opportunities!inner (
        id,
        created_by
      )
    `)
    .eq("id", params.applicationId)
    .maybeSingle();

  if (fetchErr || !application) {
    throw new Error("Application not found or unauthorized.");
  }

  const opp = (application as any).opportunities;
  if (!opp || opp.created_by !== user.id) {
    throw new Error("Unauthorized: You do not own the opportunity for this application.");
  }

  // 2. Validate transition
  const validation = isValidStatusTransition(
    application.status as ApplicationStatus,
    params.newStatus,
    "industry"
  );

  if (!validation.allowed) {
    throw new Error(validation.reason || "Invalid status transition.");
  }

  // 3. Update status (also guarded by database trigger trg_applications_update)
  const { error: updateErr } = await supabase
    .from("applications")
    .update({ status: params.newStatus })
    .eq("id", params.applicationId);

  if (updateErr) {
    throw new Error(`Failed to update candidate status: ${updateErr.message}`);
  }

  revalidatePath("/industry/applications");
  revalidatePath(`/industry/applications/${params.applicationId}`);
  revalidatePath("/student/applications");

  return { success: true };
}

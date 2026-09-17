"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
};

/**
 * Start tracking an internship/placement for a selected application.
 * Caller must be the industry owner who created the opportunity for this application.
 */
export async function createPlacementTracking(formData: {
  applicationId: string;
  engagementType: "internship" | "placement";
  startDate?: string;
  expectedEndDate?: string;
  supervisorName?: string;
  supervisorEmail?: string;
}): Promise<ActionResponse> {
  try {
    const { user } = await requireRole("industry");
    const supabase = await createClient();

    // 1. Verify application exists, is 'selected', and opportunity was created by auth.uid()
    const { data: application, error: appErr } = await supabase
      .from("applications")
      .select(`
        id,
        status,
        opportunity_id,
        opportunities!inner (
          id,
          created_by,
          opportunity_type
        )
      `)
      .eq("id", formData.applicationId)
      .single();

    if (appErr || !application) {
      return { success: false, error: "Referenced application not found." };
    }

    if (application.status !== "selected") {
      return {
        success: false,
        error: `Tracking can only be initiated for applications with status 'selected' (current: ${application.status}).`,
      };
    }

    // Opportunity owner check
    const opp = Array.isArray(application.opportunities)
      ? application.opportunities[0]
      : application.opportunities;

    if (!opp || opp.created_by !== user.id) {
      return { success: false, error: "Unauthorized: You do not own this opportunity." };
    }

    // 2. Insert into public.internship_placements
    const { data, error } = await supabase
      .from("internship_placements")
      .insert({
        application_id: formData.applicationId,
        engagement_type: formData.engagementType,
        status: "selected",
        start_date: formData.startDate || null,
        expected_end_date: formData.expectedEndDate || null,
        supervisor_name: formData.supervisorName?.trim() || null,
        supervisor_email: formData.supervisorEmail?.trim() || null,
        progress_percent: 0,
      })
      .select("id, status, engagement_type")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "A tracking record already exists for this application." };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/industry/internship-placement");
    revalidatePath("/industry/dashboard");
    revalidatePath("/student/internship-placement");

    return {
      success: true,
      message: "Internship / Placement tracking initiated successfully.",
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Update an existing placement tracking record.
 * Allowed transitions:
 * selected -> offer_accepted | withdrawn
 * offer_accepted -> joined | withdrawn
 * joined -> in_progress
 * in_progress -> completed
 */
export async function updatePlacementTracking(
  placementId: string,
  updates: {
    status?: "selected" | "offer_accepted" | "joined" | "in_progress" | "completed" | "withdrawn";
    startDate?: string;
    expectedEndDate?: string;
    actualEndDate?: string;
    progressPercent?: number;
    supervisorName?: string;
    supervisorEmail?: string;
    outcome?: string;
  }
): Promise<ActionResponse> {
  try {
    const { user } = await requireRole("industry");
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {};

    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.startDate !== undefined) updatePayload.start_date = updates.startDate || null;
    if (updates.expectedEndDate !== undefined) updatePayload.expected_end_date = updates.expectedEndDate || null;
    if (updates.actualEndDate !== undefined) updatePayload.actual_end_date = updates.actualEndDate || null;
    if (updates.progressPercent !== undefined) updatePayload.progress_percent = Number(updates.progressPercent);
    if (updates.supervisorName !== undefined) updatePayload.supervisor_name = updates.supervisorName?.trim() || null;
    if (updates.supervisorEmail !== undefined) updatePayload.supervisor_email = updates.supervisorEmail?.trim() || null;
    if (updates.outcome !== undefined) updatePayload.outcome = updates.outcome?.trim() || null;

    // The database trigger handle_internship_placement_update() protects application_id, created_at,
    // and enforces status state machine.
    const { data, error } = await supabase
      .from("internship_placements")
      .update(updatePayload)
      .eq("id", placementId)
      .select("id, status, progress_percent")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/industry/internship-placement");
    revalidatePath("/industry/dashboard");
    revalidatePath("/student/internship-placement");
    revalidatePath("/institution/internship-placement");

    return {
      success: true,
      message: "Placement tracking updated successfully.",
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

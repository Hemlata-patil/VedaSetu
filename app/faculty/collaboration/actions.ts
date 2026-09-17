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
 * Express interest in a published faculty opportunity.
 * Caller must be an authenticated faculty user.
 */
export async function expressInterest(
  opportunityId: string,
  message?: string
): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireRole("faculty");
    const supabase = await createClient();

    // Verify opportunity exists and is published
    const { data: opp, error: oppErr } = await supabase
      .from("faculty_opportunities")
      .select("id, status, title")
      .eq("id", opportunityId)
      .single();

    if (oppErr || !opp) {
      return { success: false, error: "Opportunity not found." };
    }

    if (opp.status !== "published") {
      return { success: false, error: "Only published opportunities are open for interest expression." };
    }

    // Insert interest record via standard authenticated client
    const { data, error } = await supabase
      .from("faculty_opportunity_interests")
      .insert({
        opportunity_id: opportunityId,
        faculty_id: user.id,
        message: message?.trim() || null,
        status: "interested",
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "You have already expressed interest in this opportunity." };
      }
      return { success: false, error: error.message };
    }

    revalidatePath(`/faculty/collaboration/${opportunityId}`);
    revalidatePath("/faculty/collaboration/interests");
    revalidatePath("/faculty/dashboard");

    return {
      success: true,
      message: "Your interest has been submitted successfully.",
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Withdraw an expressed interest.
 * Allowed transitions: interested -> withdrawn, under_review -> withdrawn.
 */
export async function withdrawInterest(interestId: string): Promise<ActionResponse> {
  try {
    const { user } = await requireRole("faculty");
    const supabase = await createClient();

    // The database trigger public.validate_faculty_interest_mutation enforces:
    // applicant can only change status to 'withdrawn', and only from 'interested' or 'under_review'
    const { data, error } = await supabase
      .from("faculty_opportunity_interests")
      .update({ status: "withdrawn" })
      .eq("id", interestId)
      .eq("faculty_id", user.id)
      .select("id, opportunity_id, status")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.opportunity_id) {
      revalidatePath(`/faculty/collaboration/${data.opportunity_id}`);
    }
    revalidatePath("/faculty/collaboration/interests");
    revalidatePath("/faculty/dashboard");

    return {
      success: true,
      message: "Your interest has been withdrawn.",
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Update message while status = 'interested'
 */
export async function updateInterestMessage(
  interestId: string,
  message: string
): Promise<ActionResponse> {
  try {
    const { user } = await requireRole("faculty");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("faculty_opportunity_interests")
      .update({ message: message.trim() || null })
      .eq("id", interestId)
      .eq("faculty_id", user.id)
      .select("id, opportunity_id, message")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.opportunity_id) {
      revalidatePath(`/faculty/collaboration/${data.opportunity_id}`);
    }
    revalidatePath("/faculty/collaboration/interests");

    return {
      success: true,
      message: "Your message has been updated.",
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Opportunity Owner action: Review interest status.
 * State machine enforced by DB trigger:
 * interested -> under_review
 * under_review -> accepted / rejected
 */
export async function updateInterestStatus(
  interestId: string,
  newStatus: "under_review" | "accepted" | "rejected"
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Update status. Trigger will check:
    // 1) caller is the opportunity owner (created_by = auth.uid())
    // 2) status transition is valid (interested -> under_review -> accepted/rejected)
    // 3) immutable fields and message are untouched
    const { data, error } = await supabase
      .from("faculty_opportunity_interests")
      .update({ status: newStatus })
      .eq("id", interestId)
      .select("id, opportunity_id, status")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.opportunity_id) {
      revalidatePath(`/faculty/collaboration/${data.opportunity_id}`);
      revalidatePath(`/faculty/collaboration/${data.opportunity_id}/interests`);
    }

    return {
      success: true,
      message: `Interest status updated to ${newStatus}.`,
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Create a faculty opportunity.
 * Allowed creator roles: faculty, institution, industry.
 * created_by is strictly set to auth.uid().
 * Trigger validates organization_id legitimacy.
 */
export async function createFacultyOpportunity(formData: {
  title: string;
  description: string;
  opportunity_type: "fdp" | "workshop" | "research_project" | "industry_collaboration";
  provider_name?: string;
  location?: string;
  mode?: "onsite" | "hybrid" | "remote";
  start_date?: string;
  end_date?: string;
  application_deadline?: string;
  external_url?: string;
  status?: "draft" | "published";
  organization_id?: string;
}): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Fetch user profile to verify role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, institution_id, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile || !["faculty", "institution", "industry"].includes(profile.role)) {
      return { success: false, error: "Only faculty, institution, and industry users can create opportunities." };
    }

    let validOrgId: string | null = null;
    if (formData.organization_id) {
      validOrgId = formData.organization_id;
    } else if (profile.role === "industry" && profile.organization_id) {
      validOrgId = profile.organization_id;
    }

    const { data, error } = await supabase
      .from("faculty_opportunities")
      .insert({
        created_by: user.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        opportunity_type: formData.opportunity_type,
        provider_name: formData.provider_name?.trim() || null,
        location: formData.location?.trim() || null,
        mode: formData.mode || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        application_deadline: formData.application_deadline || null,
        external_url: formData.external_url?.trim() || null,
        status: formData.status || "draft",
        organization_id: validOrgId,
      })
      .select("id, title, status")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/faculty/collaboration");
    revalidatePath("/faculty/collaboration/manage");

    return {
      success: true,
      message: `Opportunity created as ${data.status}.`,
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Update opportunity status (Owner only: created_by = auth.uid())
 */
export async function updateOpportunityStatus(
  opportunityId: string,
  status: "draft" | "published" | "closed" | "archived"
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data, error } = await supabase
      .from("faculty_opportunities")
      .update({ status })
      .eq("id", opportunityId)
      .eq("created_by", user.id)
      .select("id, title, status")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/faculty/collaboration");
    revalidatePath(`/faculty/collaboration/${opportunityId}`);
    revalidatePath("/faculty/collaboration/manage");

    return {
      success: true,
      message: `Opportunity is now ${status}.`,
      data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

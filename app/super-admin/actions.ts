"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type VerificationStatus = "pending" | "approved" | "rejected" | "suspended";

/**
 * Super Admin Action: Update Institution Verification Status
 */
export async function updateInstitutionStatus(
  institutionId: string,
  status: VerificationStatus
) {
  await requireSuperAdmin();

  if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
    throw new Error("Invalid institution verification status");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("institutions")
    .update({ verification_status: status })
    .eq("id", institutionId);

  if (error) {
    throw new Error(`Failed to update institution status: ${error.message}`);
  }

  revalidatePath("/super-admin/institutions");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/analytics");
  return { success: true };
}

/**
 * Super Admin Action: Update Organization Verification Status
 */
export async function updateOrganizationStatus(
  organizationId: string,
  status: VerificationStatus
) {
  await requireSuperAdmin();

  if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
    throw new Error("Invalid organization verification status");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("organizations")
    .update({ verification_status: status })
    .eq("id", organizationId);

  if (error) {
    throw new Error(`Failed to update organization status: ${error.message}`);
  }

  revalidatePath("/super-admin/industries");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/analytics");
  return { success: true };
}

/**
 * Super Admin Action: Moderate Opportunity Status (close / archive / publish)
 */
export async function moderateOpportunityStatus(
  opportunityId: string,
  status: "published" | "closed" | "archived"
) {
  await requireSuperAdmin();

  if (!["published", "closed", "archived"].includes(status)) {
    throw new Error("Invalid opportunity moderation status");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("opportunities")
    .update({ status })
    .eq("id", opportunityId);

  if (error) {
    throw new Error(`Failed to moderate opportunity: ${error.message}`);
  }

  revalidatePath("/super-admin/opportunities");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/analytics");
  return { success: true };
}

/**
 * Super Admin Action: Safely update user role between non-admin roles.
 * Safeguards:
 * - Super admin cannot modify or downgrade themselves.
 * - Cannot downgrade another super_admin.
 * - Cannot escalate an account to super_admin from this action.
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: "student" | "faculty" | "institution" | "industry"
) {
  const { user } = await requireSuperAdmin();

  if (targetUserId === user.id) {
    throw new Error("Cannot modify your own administrative role.");
  }

  const allowedRoles = ["student", "faculty", "institution", "industry"];
  if (!allowedRoles.includes(newRole)) {
    throw new Error("Invalid target role assignment.");
  }

  const adminClient = createAdminClient();

  // Verify target user's existing role first
  const { data: targetProfile, error: fetchError } = await adminClient
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", targetUserId)
    .single();

  if (fetchError || !targetProfile) {
    throw new Error("Target user profile not found.");
  }

  if (targetProfile.role === "super_admin") {
    throw new Error("Cannot downgrade an existing Super Admin account.");
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (updateError) {
    throw new Error(`Failed to update user role: ${updateError.message}`);
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/analytics");
  return { success: true };
}

export interface CreateInstitutionParams {
  name: string;
  code?: string;
  category?: string;
  location?: string;
  adminFullName: string;
  adminEmail: string;
  temporaryPassword: string;
}

/**
 * Super Admin Action: Add an Institution and provision its initial Administrator Login Account.
 * Strictly authorized for role = 'super_admin'.
 */
export async function createInstitutionWithAdmin(params: CreateInstitutionParams) {
  await requireSuperAdmin();

  // 1. Validation
  const name = params.name?.trim();
  const code = params.code?.trim() ? params.code.trim().toUpperCase() : null;
  const category = params.category?.trim() || "Ayurveda College";
  const location = params.location?.trim() || "India";
  const adminFullName = params.adminFullName?.trim();
  const adminEmail = params.adminEmail?.trim().toLowerCase();
  const temporaryPassword = params.temporaryPassword;

  if (!name) throw new Error("Institution name is required.");
  if (!adminFullName) throw new Error("Administrator full name is required.");
  if (!adminEmail || !adminEmail.includes("@")) throw new Error("Valid administrator email is required.");
  if (!temporaryPassword || temporaryPassword.length < 6) {
    throw new Error("Temporary password must be at least 6 characters long.");
  }

  const adminClient = createAdminClient();

  // Check code uniqueness if provided
  if (code) {
    const { data: existingCode } = await adminClient
      .from("institutions")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (existingCode) {
      throw new Error(`An institution with code '${code}' already exists.`);
    }
  }

  // Check if email already exists in profiles
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existingProfile) {
    throw new Error(`An account with email '${adminEmail}' already exists. Cannot create a duplicate account.`);
  }

  // 2. Create Institution Record
  const { data: newInst, error: instErr } = await adminClient
    .from("institutions")
    .insert({
      name,
      code,
      category,
      location,
      verification_status: "approved",
    })
    .select("id, name, code")
    .single();

  if (instErr || !newInst) {
    throw new Error(`Failed to create institution record: ${instErr?.message || "Unknown error"}`);
  }

  let authUserId: string | null = null;
  try {
    // 3. Create Auth User using Admin API
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { role: "institution" },
      user_metadata: { full_name: adminFullName },
    });

    if (authErr || !authUser?.user) {
      throw new Error(authErr?.message || "Failed to create administrator authentication account.");
    }

    authUserId = authUser.user.id;

    // 4. Update Created Profile
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        role: "institution",
        institution_id: newInst.id,
        organization_id: null,
      })
      .eq("id", authUserId);

    if (profileErr) {
      throw new Error(`Failed to link institution profile: ${profileErr.message}`);
    }
  } catch (err: any) {
    // Compensating cleanup on failure
    if (authUserId) {
      try {
        await adminClient.auth.admin.deleteUser(authUserId);
      } catch (cleanupErr) {
        console.error("Cleanup error deleting auth user:", cleanupErr);
      }
    }
    try {
      await adminClient.from("institutions").delete().eq("id", newInst.id);
    } catch (cleanupErr) {
      console.error("Cleanup error deleting institution:", cleanupErr);
    }
    throw new Error(`Institution onboarding failed: ${err.message}`);
  }

  revalidatePath("/super-admin/institutions");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/analytics");

  return {
    success: true,
    institutionId: newInst.id,
    institutionName: newInst.name,
    userId: authUserId,
  };
}

export interface CreateIndustryParams {
  name: string;
  organizationType?: string;
  location?: string;
  contactFullName: string;
  contactEmail: string;
  temporaryPassword: string;
}

/**
 * Super Admin Action: Add an Industry/Organization and provision its initial Login Account.
 * Strictly authorized for role = 'super_admin'.
 */
export async function createIndustryWithAdmin(params: CreateIndustryParams) {
  await requireSuperAdmin();

  // 1. Validation
  const name = params.name?.trim();
  const organizationType = params.organizationType?.trim() || "Pharmaceutical / Healthcare";
  const location = params.location?.trim() || "India";
  const contactFullName = params.contactFullName?.trim();
  const contactEmail = params.contactEmail?.trim().toLowerCase();
  const temporaryPassword = params.temporaryPassword;

  if (!name) throw new Error("Industry / Organization name is required.");
  if (!contactFullName) throw new Error("Contact person full name is required.");
  if (!contactEmail || !contactEmail.includes("@")) throw new Error("Valid contact email is required.");
  if (!temporaryPassword || temporaryPassword.length < 6) {
    throw new Error("Temporary password must be at least 6 characters long.");
  }

  const adminClient = createAdminClient();

  // Check if email already exists in profiles
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", contactEmail)
    .maybeSingle();

  if (existingProfile) {
    throw new Error(`An account with email '${contactEmail}' already exists. Cannot create a duplicate account.`);
  }

  // 2. Create Organization Record
  const { data: newOrg, error: orgErr } = await adminClient
    .from("organizations")
    .insert({
      name,
      organization_type: organizationType,
      location,
      verification_status: "approved",
    })
    .select("id, name")
    .single();

  if (orgErr || !newOrg) {
    throw new Error(`Failed to create organization record: ${orgErr?.message || "Unknown error"}`);
  }

  let authUserId: string | null = null;
  try {
    // 3. Create Auth User using Admin API
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: contactEmail,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { role: "industry" },
      user_metadata: { full_name: contactFullName },
    });

    if (authErr || !authUser?.user) {
      throw new Error(authErr?.message || "Failed to create industry contact authentication account.");
    }

    authUserId = authUser.user.id;

    // 4. Update Created Profile
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        role: "industry",
        organization_id: newOrg.id,
        institution_id: null,
      })
      .eq("id", authUserId);

    if (profileErr) {
      throw new Error(`Failed to link industry profile: ${profileErr.message}`);
    }
  } catch (err: any) {
    // Compensating cleanup on failure
    if (authUserId) {
      try {
        await adminClient.auth.admin.deleteUser(authUserId);
      } catch (cleanupErr) {
        console.error("Cleanup error deleting auth user:", cleanupErr);
      }
    }
    try {
      await adminClient.from("organizations").delete().eq("id", newOrg.id);
    } catch (cleanupErr) {
      console.error("Cleanup error deleting organization:", cleanupErr);
    }
    throw new Error(`Industry onboarding failed: ${err.message}`);
  }

  revalidatePath("/super-admin/industries");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/analytics");

  return {
    success: true,
    organizationId: newOrg.id,
    organizationName: newOrg.name,
    userId: authUserId,
  };
}


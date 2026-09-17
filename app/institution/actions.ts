"use server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateFacultyParams {
  fullName: string;
  email: string;
  department: string;
  designation: string;
  temporaryPassword: string;
}

/**
 * Institution Action: Create a Faculty account affiliated with the authenticated Institution.
 * Strictly authorized for role = 'institution'.
 * The institution ID is strictly derived from the authenticated caller's profile.
 */
export async function createFacultyAccount(params: CreateFacultyParams) {
  // 1. Authenticate caller and enforce institution role
  const { profile: callerProfile } = await requireRole("institution");

  if (!callerProfile?.institution_id) {
    throw new Error("Your institution account is not affiliated with a valid institution.");
  }

  // 2. Validate input
  const fullName = params.fullName?.trim();
  const email = params.email?.trim().toLowerCase();
  const department = params.department?.trim();
  const designation = params.designation?.trim();
  const temporaryPassword = params.temporaryPassword;

  if (!fullName) throw new Error("Faculty full name is required.");
  if (!email || !email.includes("@")) throw new Error("Valid faculty email is required.");
  if (!department) throw new Error("Academic department is required.");
  if (!designation) throw new Error("Faculty designation is required.");
  if (!temporaryPassword || temporaryPassword.length < 6) {
    throw new Error("Temporary password must be at least 6 characters long.");
  }

  const adminClient = createAdminClient();

  // 3. Check duplicate email in profiles
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    throw new Error(`An account with email '${email}' already exists. Cannot create a duplicate account.`);
  }

  let authUserId: string | null = null;
  try {
    // 4. Create Auth User using Admin API
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { role: "faculty" },
      user_metadata: {
        full_name: fullName,
        department,
        designation,
      },
    });

    if (authErr || !authUser?.user) {
      throw new Error(authErr?.message || "Failed to create faculty authentication account.");
    }

    authUserId = authUser.user.id;

    // 5. Update Created Profile with institution affiliation and fields
    const updatePayload: Record<string, any> = {
      role: "faculty",
      institution_id: callerProfile.institution_id,
      organization_id: null,
      department,
    };

    // Update with designation; if designation column doesn't exist on live DB yet, gracefully update without designation
    const { error: profileErrWithDesig } = await adminClient
      .from("profiles")
      .update({
        ...updatePayload,
        designation,
      })
      .eq("id", authUserId);

    if (profileErrWithDesig) {
      if (profileErrWithDesig.message.includes("designation")) {
        // Fallback for live DB prior to migration deployment
        const { error: fallbackErr } = await adminClient
          .from("profiles")
          .update(updatePayload)
          .eq("id", authUserId);

        if (fallbackErr) {
          throw new Error(`Failed to link faculty profile: ${fallbackErr.message}`);
        }
      } else {
        throw new Error(`Failed to link faculty profile: ${profileErrWithDesig.message}`);
      }
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
    throw new Error(`Faculty onboarding failed: ${err.message}`);
  }

  revalidatePath("/institution/faculty");
  revalidatePath("/institution/dashboard");
  revalidatePath("/institution/students");

  return {
    success: true,
    facultyId: authUserId,
    fullName,
    email,
    department,
    designation,
  };
}

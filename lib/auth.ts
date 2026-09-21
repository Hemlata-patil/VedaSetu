import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  UserRole,
  UserProfile,
  isStudentProfileComplete,
  getRoleDashboardPath,
} from "@/lib/auth-helpers";

// Re-export all client-safe types and helpers
export type { UserRole, UserProfile };
export { isStudentProfileComplete, getRoleDashboardPath };

/**
 * Requires an authenticated user session. Redirects to /auth/login if unauthenticated.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    user,
    profile: profile as UserProfile | null,
    supabase,
  };
}

/**
 * Enforces role-based authorization based strictly on the database profiles table.
 * If the user has a different role, redirects them to their correct role dashboard.
 * A super_admin opening any standard role dashboard is redirected to /super-admin/dashboard.
 * For students: Enforces mandatory profile completion before accessing student dashboard/features,
 * unless allowIncomplete is explicitly set (e.g. for /student/complete-profile).
 */
export async function requireRole(
  expectedRole: UserRole,
  options?: { allowIncomplete?: boolean }
) {
  const { user, profile, supabase } = await requireAuth();

  if (!profile || !profile.role) {
    redirect("/profile");
  }

  const currentRole = profile.role as UserRole;

  if (currentRole !== expectedRole) {
    if (currentRole === "super_admin") {
      redirect("/super-admin/dashboard");
    }
    redirect(getRoleDashboardPath(currentRole));
  }

  // Mandatory student profile completion check — strictly exclusive to student role
  if (currentRole === "student" && !options?.allowIncomplete) {
    if (!isStudentProfileComplete(profile)) {
      redirect("/student/complete-profile");
    }
  }

  return {
    user,
    profile: profile as UserProfile,
    supabase,
  };
}

/**
 * Reusable server-side authorization function for Super Admin routes and actions.
 * Strictly verifies the authenticated user has profile.role = 'super_admin'.
 * Unauthorized users are redirected to their own role dashboard or /auth/login.
 */
export async function requireSuperAdmin() {
  const { user, profile, supabase } = await requireAuth();

  if (!profile || profile.role !== "super_admin") {
    if (profile?.role) {
      redirect(getRoleDashboardPath(profile.role));
    }
    redirect("/auth/login");
  }

  return {
    user,
    profile: profile as UserProfile,
    supabase,
  };
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "student" | "faculty" | "institution" | "industry" | "super_admin";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  institution_id: string | null;
  organization_id: string | null;
  program: string | null;
  year: number | null;
  department: string | null;
  designation?: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

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

export function getRoleDashboardPath(role: UserRole | string): string {
  if (role === "super_admin") {
    return "/super-admin/dashboard";
  }
  return `/${role}/dashboard`;
}

/**
 * Enforces role-based authorization based strictly on the database profiles table.
 * If the user has a different role, redirects them to their correct role dashboard.
 * A super_admin opening any standard role dashboard is redirected to /super-admin/dashboard.
 */
export async function requireRole(expectedRole: UserRole) {
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


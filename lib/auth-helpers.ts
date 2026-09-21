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
  qualification?: string | null;
  semester?: string | null;
  skills?: string[] | null;
  career_interests?: string[] | null;
  profile_completed?: boolean;
}

/**
 * Authoritatively validates whether a student user has completed all mandatory profile fields.
 * Does not rely solely on the `profile_completed` flag; strictly validates the presence of all required fields.
 * Pure helper function: Safe for both Client and Server Components.
 */
export function isStudentProfileComplete(profile: Partial<UserProfile> | null): boolean {
  if (!profile || profile.role !== "student") return false;

  const hasPersonal =
    Boolean(profile.full_name?.trim()) &&
    Boolean(profile.phone?.trim());

  const hasAcademic =
    Boolean(profile.qualification?.trim()) &&
    Boolean(profile.program?.trim()) &&
    Boolean(profile.department?.trim()) &&
    profile.year !== null &&
    profile.year !== undefined &&
    Number(profile.year) > 0 &&
    Boolean(profile.semester?.trim());

  const hasInstitution = Boolean(profile.institution_id?.trim());

  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const hasInterests =
    Array.isArray(profile.career_interests) && profile.career_interests.length > 0;

  return hasPersonal && hasAcademic && hasInstitution && hasSkills && hasInterests;
}

export function getRoleDashboardPath(role: UserRole | string): string {
  if (role === "super_admin") {
    return "/super-admin/dashboard";
  }
  return `/${role}/dashboard`;
}

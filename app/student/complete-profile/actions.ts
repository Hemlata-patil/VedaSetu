"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface StudentProfileInput {
  full_name: string;
  phone: string;
  qualification: string;
  program: string;
  department: string;
  year: number | string;
  semester: string;
  institution_id: string;
  skills: string[];
  career_interests: string[];
}

export async function saveStudentProfile(data: StudentProfileInput) {
  // 1. Verify authenticated session
  const { user, profile, supabase } = await requireAuth();

  // 2. Strict role authorization: Student users exclusively
  if (profile?.role !== "student") {
    throw new Error("Unauthorized: Mandatory student profile completion is restricted to student accounts.");
  }

  // 3. Field validation: Personal Details
  const fullName = data.full_name?.trim();
  if (!fullName || fullName.length < 2) {
    throw new Error("Full name is required and must be at least 2 characters.");
  }

  const phone = data.phone?.trim();
  if (!phone || phone.length < 5) {
    throw new Error("A valid contact phone number is required.");
  }

  // 4. Field validation: Academic Details
  const qualification = data.qualification?.trim();
  if (!qualification) {
    throw new Error("Academic qualification level is required.");
  }

  const program = data.program?.trim();
  if (!program) {
    throw new Error("Academic course / degree program is required.");
  }

  const department = data.department?.trim();
  if (!department) {
    throw new Error("Academic specialization / department is required.");
  }

  const yearNum = Number(data.year);
  if (isNaN(yearNum) || yearNum < 1 || yearNum > 10) {
    throw new Error("Current academic year must be a valid number between 1 and 10.");
  }

  const semester = data.semester?.trim();
  if (!semester) {
    throw new Error("Current semester or professional stage is required.");
  }

  // 5. Institution validation: Strictly verify verification_status = 'approved' from public.institutions
  const institutionId = data.institution_id?.trim();
  if (!institutionId) {
    throw new Error("An approved institution must be selected.");
  }

  const { data: institutionRecord, error: instError } = await supabase
    .from("institutions")
    .select("id, name, verification_status")
    .eq("id", institutionId)
    .maybeSingle();

  if (instError || !institutionRecord) {
    throw new Error("Selected institution was not found in the platform registry.");
  }

  // Strict approved-only check: null, pending, rejected, suspended are completely rejected
  if (institutionRecord.verification_status !== "approved") {
    throw new Error("The selected institution is not currently approved by administration. Only approved institutions may be selected.");
  }

  // 6. Field validation: Skills & Career Interests (minimum 1 each)
  const skills = Array.isArray(data.skills)
    ? data.skills.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (skills.length === 0) {
    throw new Error("At least one clinical or academic skill must be selected or specified.");
  }

  const careerInterests = Array.isArray(data.career_interests)
    ? data.career_interests.map((ci) => String(ci).trim()).filter(Boolean)
    : [];
  if (careerInterests.length === 0) {
    throw new Error("At least one career interest or objective must be selected or specified.");
  }

  // 7. Scoped update to public.profiles strictly for authenticated user.id
  // Role is strictly omitted and immutable.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone,
      qualification: qualification,
      program: program,
      department: department,
      year: yearNum,
      semester: semester,
      institution_id: institutionId,
      skills: skills,
      career_interests: careerInterests,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(`Failed to save profile: ${updateError.message}`);
  }

  // 8. Revalidate paths to update cached views
  revalidatePath("/student/dashboard");
  revalidatePath("/student/complete-profile");
  revalidatePath("/profile");

  return { success: true };
}

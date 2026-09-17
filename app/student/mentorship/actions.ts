"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface RequestMentorshipParams {
  facultyId: string;
  requestNote?: string;
}

export async function requestMentorship(params: RequestMentorshipParams) {
  // 1. Require authenticated user & role = student
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  if (!params.facultyId) {
    throw new Error("Faculty mentor selection is required.");
  }

  // 2. Validate student has an affiliated institution
  if (!profile?.institution_id) {
    throw new Error("Your student profile must be affiliated with an academic institution to request mentorship.");
  }

  // 3. Validate target faculty:
  // - role = faculty
  // - institution_id is not null
  // - same institution as student
  const { data: faculty, error: facErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, institution_id")
    .eq("id", params.facultyId)
    .maybeSingle();

  if (facErr || !faculty || faculty.role !== "faculty" || !faculty.institution_id || faculty.institution_id !== profile.institution_id) {
    throw new Error("Unauthorized: The selected faculty member is not affiliated with your institution.");
  }

  // 4. Check whether pending or active relationship already exists between this pair
  const { data: existing } = await supabase
    .from("mentorships")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("faculty_id", params.facultyId)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (existing) {
    if (existing.status === "pending") {
      throw new Error("You already have a pending mentorship request submitted to this faculty member.");
    }
    if (existing.status === "active") {
      throw new Error("You already have an active mentorship with this faculty member.");
    }
  }

  // Also check if student already has another active mentorship
  const { data: anyActive } = await supabase
    .from("mentorships")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (anyActive) {
    throw new Error("You already have an active faculty mentor. A student may have at most one active mentorship at a time.");
  }

  // 5. Insert new mentorship record:
  // student_id = auth.uid()
  // faculty_id = selected faculty
  // status = pending
  // requested_by = auth.uid()
  // request_note = submitted message
  const { data: newMentorship, error: insertErr } = await supabase
    .from("mentorships")
    .insert({
      student_id: user.id,
      faculty_id: params.facultyId,
      status: "pending",
      requested_by: user.id,
      request_note: params.requestNote?.trim() || null,
    })
    .select("id")
    .single();

  if (insertErr || !newMentorship) {
    throw new Error(`Failed to submit mentorship request: ${insertErr?.message || "Unknown error"}`);
  }

  revalidatePath("/student/dashboard");
  revalidatePath("/student/mentorship");
  revalidatePath("/faculty/mentorship");

  return { success: true, mentorshipId: newMentorship.id };
}

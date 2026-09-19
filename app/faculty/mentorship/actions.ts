"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateMentorshipParams {
  studentId: string;
  mentorNote?: string;
}

export async function createMentorship(params: CreateMentorshipParams) {
  const { user, profile } = await requireRole("faculty");
  const supabase = await createClient();

  if (!params.studentId) {
    throw new Error("Student ID is required.");
  }

  if (!profile?.institution_id) {
    throw new Error("Your faculty profile must be associated with an institution to initiate mentorship.");
  }

  // 1. Verify student belongs to the same institution
  const { data: student, error: stuErr } = await supabase
    .from("profiles")
    .select("id, role, institution_id")
    .eq("id", params.studentId)
    .maybeSingle();

  if (stuErr || !student || student.role !== "student" || student.institution_id !== profile.institution_id) {
    throw new Error("Unauthorized: Student does not belong to your affiliated institution.");
  }

  // 2. Check for duplicate active or pending mentorship
  const { data: existing } = await supabase
    .from("mentorships")
    .select("id, status")
    .eq("faculty_id", user.id)
    .eq("student_id", params.studentId)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (existing) {
    throw new Error("An active or pending mentorship record already exists for this student.");
  }

  // Verify student does not already have an active mentorship with another faculty
  const { data: anyActive } = await supabase
    .from("mentorships")
    .select("id")
    .eq("student_id", params.studentId)
    .eq("status", "active")
    .maybeSingle();

  if (anyActive) {
    throw new Error("This student already has an active faculty mentor. A student may have at most one active mentorship at a time.");
  }

  // 3. Insert new mentorship record
  const { data: newMentorship, error: insertErr } = await supabase
    .from("mentorships")
    .insert({
      faculty_id: user.id,
      student_id: params.studentId,
      requested_by: user.id,
      mentor_note: params.mentorNote?.trim() || null,
      status: "active",
    })
    .select("id")
    .single();

  if (insertErr || !newMentorship) {
    throw new Error(`Failed to initiate mentorship: ${insertErr?.message || "Unknown error"}`);
  }

  revalidatePath("/faculty/dashboard");
  revalidatePath("/faculty/students");
  revalidatePath(`/faculty/students/${params.studentId}`);
  revalidatePath("/faculty/mentorship");

  return { success: true, mentorshipId: newMentorship.id };
}

export interface UpdateMentorshipNoteParams {
  mentorshipId: string;
  mentorNote: string;
}

export async function updateMentorshipNote(params: UpdateMentorshipNoteParams) {
  const { user } = await requireRole("faculty");
  const supabase = await createClient();

  if (!params.mentorshipId) {
    throw new Error("Mentorship ID is required.");
  }

  const { error } = await supabase
    .from("mentorships")
    .update({ mentor_note: params.mentorNote.trim() })
    .eq("id", params.mentorshipId)
    .eq("faculty_id", user.id);

  if (error) {
    throw new Error(`Failed to update mentor note: ${error.message}`);
  }

  revalidatePath("/faculty/dashboard");
  revalidatePath("/faculty/students");
  revalidatePath("/faculty/mentorship");

  return { success: true };
}

export async function completeMentorship(param: string | { mentorshipId: string }) {
  const { user } = await requireRole("faculty");
  const supabase = await createClient();

  const mentorshipId = typeof param === "string" ? param : param.mentorshipId;
  if (!mentorshipId) {
    throw new Error("Mentorship ID is required.");
  }

  const { error } = await supabase
    .from("mentorships")
    .update({ status: "completed" })
    .eq("id", mentorshipId)
    .eq("faculty_id", user.id);

  if (error) {
    throw new Error(`Failed to mark mentorship completed: ${error.message}`);
  }

  revalidatePath("/faculty/dashboard");
  revalidatePath("/faculty/students");
  revalidatePath("/faculty/mentorship");

  return { success: true };
}

export async function acceptMentorshipRequest(param: string | { mentorshipId: string }) {
  const { user, profile } = await requireRole("faculty");
  const supabase = await createClient();

  const mentorshipId = typeof param === "string" ? param : param.mentorshipId;
  if (!mentorshipId) {
    throw new Error("Mentorship ID is required.");
  }

  // 1. Verify mentorship exists and belongs to authenticated faculty
  const { data: mentorship, error: fetchErr } = await supabase
    .from("mentorships")
    .select("id, faculty_id, student_id, status")
    .eq("id", mentorshipId)
    .maybeSingle();

  if (fetchErr || !mentorship) {
    throw new Error("Mentorship request not found.");
  }

  if (mentorship.faculty_id !== user.id) {
    throw new Error("Unauthorized: You can only accept mentorship requests addressed to you.");
  }

  if (mentorship.status !== "pending") {
    throw new Error(`Cannot accept request: current status is '${mentorship.status}'. Only pending requests can be accepted.`);
  }

  // 2. Verify same-institution affiliation
  const { data: student, error: stuErr } = await supabase
    .from("profiles")
    .select("id, role, institution_id")
    .eq("id", mentorship.student_id)
    .maybeSingle();

  if (stuErr || !student || student.role !== "student" || !student.institution_id || student.institution_id !== profile.institution_id) {
    throw new Error("Unauthorized: Student does not belong to your affiliated institution.");
  }

  // 3. Verify student does not already have an active mentorship with another faculty
  const { data: existingActive } = await supabase
    .from("mentorships")
    .select("id")
    .eq("student_id", mentorship.student_id)
    .eq("status", "active")
    .neq("id", mentorshipId)
    .maybeSingle();

  if (existingActive) {
    throw new Error("Cannot accept request: Student already has an active faculty mentor. A student may have at most one active mentorship at a time.");
  }

  // 4. Update status to active (preserves all other immutable fields)
  const { error: updateErr } = await supabase
    .from("mentorships")
    .update({ status: "active" })
    .eq("id", mentorshipId)
    .eq("faculty_id", user.id);

  if (updateErr) {
    throw new Error(`Failed to accept mentorship request: ${updateErr.message}`);
  }

  // 5. Create Mentor Messaging structures
  // Insert into mentorship_pairs
  await supabase
    .from("mentorship_pairs")
    .upsert(
      { student_id: mentorship.student_id, mentor_id: user.id },
      { onConflict: "student_id, mentor_id", ignoreDuplicates: true }
    );
    
  // Insert into mentor_conversations
  await supabase
    .from("mentor_conversations")
    .upsert(
      { student_id: mentorship.student_id, mentor_id: user.id },
      { onConflict: "student_id, mentor_id", ignoreDuplicates: true }
    );

  revalidatePath("/faculty/dashboard");
  revalidatePath("/faculty/students");
  revalidatePath(`/faculty/students/${mentorship.student_id}`);
  revalidatePath("/faculty/mentorship");
  revalidatePath("/student/dashboard");
  revalidatePath("/student/mentorship");

  return { success: true };
}

export async function rejectMentorshipRequest(param: string | { mentorshipId: string }) {
  const { user, profile } = await requireRole("faculty");
  const supabase = await createClient();

  const mentorshipId = typeof param === "string" ? param : param.mentorshipId;
  if (!mentorshipId) {
    throw new Error("Mentorship ID is required.");
  }

  // 1. Verify mentorship exists and belongs to authenticated faculty
  const { data: mentorship, error: fetchErr } = await supabase
    .from("mentorships")
    .select("id, faculty_id, student_id, status")
    .eq("id", mentorshipId)
    .maybeSingle();

  if (fetchErr || !mentorship) {
    throw new Error("Mentorship request not found.");
  }

  if (mentorship.faculty_id !== user.id) {
    throw new Error("Unauthorized: You can only reject mentorship requests addressed to you.");
  }

  if (mentorship.status !== "pending") {
    throw new Error(`Cannot reject request: current status is '${mentorship.status}'. Only pending requests can be rejected.`);
  }

  // 2. Verify same-institution affiliation
  const { data: student, error: stuErr } = await supabase
    .from("profiles")
    .select("id, role, institution_id")
    .eq("id", mentorship.student_id)
    .maybeSingle();

  if (stuErr || !student || student.role !== "student" || !student.institution_id || student.institution_id !== profile.institution_id) {
    throw new Error("Unauthorized: Student does not belong to your affiliated institution.");
  }

  // 3. Update status to rejected
  const { error: updateErr } = await supabase
    .from("mentorships")
    .update({ status: "rejected" })
    .eq("id", mentorshipId)
    .eq("faculty_id", user.id);

  if (updateErr) {
    throw new Error(`Failed to reject mentorship request: ${updateErr.message}`);
  }

  revalidatePath("/faculty/dashboard");
  revalidatePath("/faculty/students");
  revalidatePath(`/faculty/students/${mentorship.student_id}`);
  revalidatePath("/faculty/mentorship");
  revalidatePath("/student/dashboard");
  revalidatePath("/student/mentorship");

  return { success: true };
}

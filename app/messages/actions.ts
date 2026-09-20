"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function sendMessage(conversationId: string, message: string) {
  const { user, profile } = await requireAuth();
  const supabase = await createClient();

  if (!profile || (profile.role !== "student" && profile.role !== "faculty")) {
    throw new Error("Unauthorized role");
  }

  const senderRole = profile.role === "student" ? "student" : "mentor";

  const { error } = await supabase
    .from("mentor_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: senderRole,
      message: message.trim(),
    });

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return { success: true };
}

export async function getConversation(studentId?: string, mentorId?: string) {
  const { user, profile } = await requireAuth();
  const supabase = await createClient();

  let query = supabase.from("mentor_conversations").select("*, student:profiles!student_id(full_name, avatar_url), mentor:profiles!mentor_id(full_name, avatar_url)");

  if (profile?.role === "student") {
    query = query.eq("student_id", user.id);
    if (mentorId) query = query.eq("mentor_id", mentorId);
  } else if (profile?.role === "faculty") {
    query = query.eq("mentor_id", user.id);
    if (studentId) query = query.eq("student_id", studentId);
  } else {
    throw new Error("Unauthorized role");
  }

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch conversation: ${error.message}`);
  }

  if (!data) {
    // We need target student and mentor ids to auto-create
    let targetStudentId = profile?.role === "student" ? user.id : studentId;
    let targetMentorId = profile?.role === "faculty" ? user.id : mentorId;
    
    if (targetStudentId && targetMentorId) {
      await supabase.from("mentor_conversations").upsert(
        { student_id: targetStudentId, mentor_id: targetMentorId },
        { onConflict: "student_id, mentor_id", ignoreDuplicates: true }
      );
      
      const { data: newData, error: newError } = await query.maybeSingle();
      if (!newError && newData) return newData;
    }
  }

  return data;
}

export async function createRecommendation(conversationId: string, studentId: string, title: string, description: string, type: string, priority: string) {
  const { user, profile } = await requireAuth();
  const supabase = await createClient();

  if (profile?.role !== "faculty") {
    throw new Error("Only mentors can create recommendations");
  }

  const { error } = await supabase
    .from("mentor_recommendations")
    .insert({
      conversation_id: conversationId,
      student_id: studentId,
      mentor_id: user.id,
      title,
      description,
      type,
      priority,
    });

  if (error) {
    throw new Error(`Failed to create recommendation: ${error.message}`);
  }

  revalidatePath("/faculty/messages");
  revalidatePath("/student/messages");
  
  return { success: true };
}

export async function updateRecommendationStatus(recommendationId: string, status: string) {
  const { user, profile } = await requireAuth();
  const supabase = await createClient();

  if (profile?.role !== "student") {
    throw new Error("Only students can update recommendation status");
  }

  const { error } = await supabase
    .from("mentor_recommendations")
    .update({ status })
    .eq("id", recommendationId)
    .eq("student_id", user.id);

  if (error) {
    throw new Error(`Failed to update recommendation: ${error.message}`);
  }

  revalidatePath("/student/recommendations");
  
  return { success: true };
}

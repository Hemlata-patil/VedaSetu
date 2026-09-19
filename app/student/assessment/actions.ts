"use server";

import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SaveAnswerParams {
  attemptId: string;
  questionId: string;
  answerValue?: number | null;
  answerText?: string | null;
}

export async function startAssessment(templateId: string, forceNew = false) {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  // 1. If not forcing a new attempt, check if an unfinished attempt already exists
  if (!forceNew) {
    const { data: inProgressAttempt, error: fetchErr } = await supabase
      .from("assessment_attempts")
      .select("id, status")
      .eq("student_id", user.id)
      .eq("assessment_template_id", templateId)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("[startAssessment] Error checking in-progress attempt:", fetchErr.message);
    }

    if (inProgressAttempt) {
      if (inProgressAttempt.status === "not_started") {
        // Transition from not_started -> in_progress (triggers started_at = now())
        const { error: updErr } = await supabase
          .from("assessment_attempts")
          .update({ status: "in_progress" })
          .eq("id", inProgressAttempt.id);

        if (updErr) {
          throw new Error(`Failed to resume attempt: ${updErr.message}`);
        }
      }
      revalidatePath("/student/dashboard");
      revalidatePath("/student/assessment");
      return { attemptId: inProgressAttempt.id, status: inProgressAttempt.status };
    }
  }

  // 2. Create new attempt in 'not_started' status (strict RLS rule)
  const { data: newAttempt, error: insertErr } = await supabase
    .from("assessment_attempts")
    .insert({
      assessment_template_id: templateId,
      student_id: user.id,
      status: "not_started",
    })
    .select("id")
    .single();

  if (insertErr || !newAttempt) {
    throw new Error(`Failed to create assessment attempt: ${insertErr?.message || "Unknown error"}`);
  }

  // 3. Immediately transition to 'in_progress' to start the clock
  const { error: startErr } = await supabase
    .from("assessment_attempts")
    .update({ status: "in_progress" })
    .eq("id", newAttempt.id);

  if (startErr) {
    throw new Error(`Failed to initialize assessment attempt: ${startErr.message}`);
  }

  revalidatePath("/student/dashboard");
  revalidatePath("/student/assessment");
  return { attemptId: newAttempt.id, status: "in_progress" };
}

export async function saveAnswer(params: SaveAnswerParams) {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  // Verify that the attempt belongs to user and is in_progress
  const { data: attempt, error: attemptErr } = await supabase
    .from("assessment_attempts")
    .select("id, status")
    .eq("id", params.attemptId)
    .eq("student_id", user.id)
    .single();

  if (attemptErr || !attempt) {
    return { success: false, error: "Attempt not found or unauthorized." };
  }

  if (attempt.status !== "in_progress") {
    return { success: false, error: "Assessment attempt is not in progress." };
  }

  // Upsert answer. Note: assessment_template_id is auto-derived by database trigger
  const { error: ansErr } = await supabase
    .from("assessment_answers")
    .upsert(
      {
        attempt_id: params.attemptId,
        question_id: params.questionId,
        answer_value: params.answerValue,
        answer_text: params.answerText,
      },
      { onConflict: "attempt_id,question_id" }
    );

  if (ansErr) {
    return { success: false, error: ansErr.message };
  }

  return { success: true };
}

export async function submitAssessment(attemptId: string) {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  // 1. Verify attempt ownership and state using client session
  const { data: attempt, error: attemptErr } = await supabase
    .from("assessment_attempts")
    .select("id, assessment_template_id, status")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single();

  if (attemptErr || !attempt) {
    throw new Error("Assessment attempt not found or access denied.");
  }

  if (attempt.status !== "in_progress") {
    throw new Error("Only in-progress assessments can be submitted.");
  }

  // 2. Perform trusted server-side scoring using admin client (service_role)
  const adminSupabase = createAdminClient();

  // Fetch all active questions for this template
  const { data: questions, error: qErr } = await adminSupabase
    .from("assessment_questions")
    .select("id, competency_id, question_type, weight, max_score")
    .eq("assessment_template_id", attempt.assessment_template_id)
    .eq("is_active", true);

  if (qErr || !questions || questions.length === 0) {
    throw new Error("Failed to load assessment questions for scoring.");
  }

  // Fetch all answers submitted by the student for this attempt
  const { data: answers, error: aErr } = await adminSupabase
    .from("assessment_answers")
    .select("question_id, answer_value, answer_text")
    .eq("attempt_id", attemptId);

  if (aErr) {
    throw new Error("Failed to load student answers for scoring.");
  }

  // Fetch protected question keys (isolated from client)
  const questionIds = questions.map((q) => q.id);
  const { data: keys, error: kErr } = await adminSupabase
    .from("assessment_question_keys")
    .select("question_id, correct_answer")
    .in("question_id", questionIds);

  if (kErr || !keys) {
    throw new Error("Failed to retrieve assessment key for scoring.");
  }

  const answersMap = new Map(answers?.map((a) => [a.question_id, a]) || []);
  const keysMap = new Map(keys.map((k) => [k.question_id, k.correct_answer]) || []);

  // 3. Compute Competency Scores (80% MCQ, 20% Self-Rating)
  // Self-rating mapping: 1=20, 2=40, 3=60, 4=80, 5=100
  const selfRatingScaleMap: Record<number, number> = {
    1: 20,
    2: 40,
    3: 60,
    4: 80,
    5: 100,
  };

  // Group questions by competency
  const competencyGroups = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = competencyGroups.get(q.competency_id) || [];
    list.push(q);
    competencyGroups.set(q.competency_id, list);
  }

  const competencyResults: Array<{
    competencyId: string;
    score: number;
  }> = [];

  let totalScoreSum = 0;

  for (const [compId, group] of competencyGroups.entries()) {
    let mcqScore = 0;
    let selfRatingScore = 0;

    for (const q of group) {
      const studentAns = answersMap.get(q.id);

      if (q.question_type === "mcq") {
        const correctKey = keysMap.get(q.id);
        const correctVal = typeof correctKey === "object" && correctKey !== null ? (correctKey as any).value : correctKey;
        const studentVal = studentAns?.answer_text || studentAns?.answer_value;

        if (
          studentVal &&
          correctVal &&
          String(studentVal).trim().toUpperCase() === String(correctVal).trim().toUpperCase()
        ) {
          mcqScore = 100;
        } else {
          mcqScore = 0;
        }
      } else if (q.question_type === "self_rating") {
        const rawRating = Number(studentAns?.answer_value || 0);
        selfRatingScore = selfRatingScaleMap[rawRating] || 0;
      }
    }

    // Weighted formula: 80% MCQ + 20% Self-Rating
    const finalCompScore = Math.round(0.8 * mcqScore + 0.2 * selfRatingScore);
    competencyResults.push({
      competencyId: compId,
      score: finalCompScore,
    });

    totalScoreSum += finalCompScore;
  }

  const overallScore = competencyResults.length > 0 ? Math.round(totalScoreSum / competencyResults.length) : 0;

  // 4. Update student_competencies in trusted admin mode
  const now = new Date().toISOString();
  const studentCompetencyRows = competencyResults.map((cr) => ({
    student_id: user.id,
    competency_id: cr.competencyId,
    proficiency_score: cr.score,
    last_assessed_at: now,
    source: "Platform Assessment: Ayush Skill & Competency Assessment",
    verified: false,
  }));

  const { error: compUpdateErr } = await adminSupabase
    .from("student_competencies")
    .upsert(studentCompetencyRows, { onConflict: "student_id,competency_id" });

  if (compUpdateErr) {
    throw new Error(`Failed to record competency scores: ${compUpdateErr.message}`);
  }

  // 5. Finalize assessment_attempt (status = submitted, total_score, submitted_at)
  const { error: finalizeErr } = await adminSupabase
    .from("assessment_attempts")
    .update({
      status: "submitted",
      total_score: overallScore,
      submitted_at: now,
    })
    .eq("id", attemptId);

  if (finalizeErr) {
    throw new Error(`Failed to finalize assessment attempt: ${finalizeErr.message}`);
  }

  // Revalidate routes
  revalidatePath("/student/dashboard");
  revalidatePath(`/student/assessment`);
  revalidatePath(`/student/assessment/${attemptId}`);
  revalidatePath(`/student/assessment/result/${attemptId}`);

  return {
    success: true,
    totalScore: overallScore,
    redirectUrl: `/student/assessment/result/${attemptId}`,
  };
}

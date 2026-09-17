import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AssessmentRunner } from "@/components/assessment/assessment-runner";

import { Suspense } from "react";

export const metadata = {
  title: "Assessment Runner — VEDA SETU",
  description: "Ayush student competency assessment session",
};

interface AssessmentRunnerPageProps {
  params: Promise<{
    attemptId: string;
  }>;
}

async function AssessmentRunnerContent({ params }: AssessmentRunnerPageProps) {
  const { attemptId } = await params;
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 1. Fetch the student's attempt
  const { data: attempt, error: attemptError } = await supabase
    .from("assessment_attempts")
    .select("id, student_id, assessment_template_id, status, started_at, submitted_at, total_score")
    .eq("id", attemptId)
    .single();

  if (attemptError || !attempt) {
    notFound();
  }

  // Ensure student owns this attempt (RLS already enforces this, but explicit check for safety)
  if (attempt.student_id !== user.id) {
    notFound();
  }

  // If already submitted, redirect to result page
  if (attempt.status === "submitted") {
    redirect(`/student/assessment/result/${attemptId}`);
  }

  // If attempt is not_started, transition to in_progress now
  if (attempt.status === "not_started") {
    await supabase
      .from("assessment_attempts")
      .update({ status: "in_progress" })
      .eq("id", attemptId);
  }

  // 2. Fetch template details
  const { data: template } = await supabase
    .from("assessment_templates")
    .select("id, title, description, program")
    .eq("id", attempt.assessment_template_id)
    .single();

  if (!template) {
    notFound();
  }

  // 3. Fetch questions (public/student-safe columns only - NO keys)
  const { data: questions, error: questionsError } = await supabase
    .from("assessment_questions")
    .select(`
      id,
      question,
      question_type,
      options,
      competency_id,
      created_at,
      competencies (
        id,
        name,
        category
      )
    `)
    .eq("assessment_template_id", attempt.assessment_template_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (questionsError || !questions || questions.length === 0) {
    return (
      <DashboardShell
        userRole="student"
        userName={profile?.full_name || "Ayush Scholar"}
        userEmail={user.email || "student@institution.edu.in"}
        breadcrumbs={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Assessment", href: "/student/assessment" },
          { label: "Runner" },
        ]}
      >
        <div className="py-12 text-center text-ayush-muted">
          No active questions found for this assessment template.
        </div>
      </DashboardShell>
    );
  }

  // 4. Fetch existing answers for this attempt
  const { data: existingAnswers } = await supabase
    .from("assessment_answers")
    .select("question_id, answer_value, answer_text")
    .eq("attempt_id", attemptId);

  const initialAnswers: Record<string, { answerValue?: number; answerText?: string }> = {};
  if (existingAnswers) {
    for (const ans of existingAnswers) {
      initialAnswers[ans.question_id] = {
        answerValue: ans.answer_value ?? undefined,
        answerText: ans.answer_text ?? undefined,
      };
    }
  }

  // Format question records
  const formattedQuestions = questions.map((q, idx) => {
    // competencies join can return an object or array in Supabase typed return
    const comp = Array.isArray(q.competencies) ? q.competencies[0] : q.competencies;
    return {
      id: q.id,
      question_number: idx + 1,
      question_type: q.question_type as "mcq" | "self_rating",
      question_text: q.question,
      options: (q.options as any) || null,
      competency_id: q.competency_id,
      competency: comp
        ? {
            name: comp.name,
            category: comp.category,
          }
        : undefined,
    };
  });

  return (
    <DashboardShell
      userRole="student"
      userName={profile?.full_name || "Ayush Scholar"}
      userEmail={user.email || "student@institution.edu.in"}
      breadcrumbs={[
        { label: "Dashboard", href: "/student/dashboard" },
        { label: "Assessment Overview", href: "/student/assessment" },
        { label: template.title },
      ]}
    >
      <AssessmentRunner
        attemptId={attemptId}
        templateTitle={template.title}
        questions={formattedQuestions}
        initialAnswers={initialAnswers}
      />
    </DashboardShell>
  );
}

export default function AssessmentRunnerPage(props: AssessmentRunnerPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Assessment Session...
          </div>
        </div>
      }
    >
      <AssessmentRunnerContent {...props} />
    </Suspense>
  );
}

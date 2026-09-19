"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  generatePersonalizedLearningRoadmap,
  DeidentifiedStudentCompetencyProfile,
  GenerateLearningRoadmapResult,
} from "@/lib/ai/learning-roadmap";
import { CompetencyCategory } from "@/lib/competencies";

/**
 * Server action to generate an AI-powered personalized learning roadmap for an authenticated student
 * based on their verified competency assessment results from Supabase.
 */
export async function getPersonalizedLearningRoadmapAction(): Promise<GenerateLearningRoadmapResult> {
  // 1. Authenticate the student on the server
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 2. Fetch student's assessed competencies
  const { data: studentComps, error: compErr } = await supabase
    .from("student_competencies")
    .select(`
      competency_id,
      proficiency_score,
      last_assessed_at,
      source,
      verified,
      competencies (
        id,
        name,
        category,
        description
      )
    `)
    .eq("student_id", user.id);

  if (compErr) {
    console.error("[getPersonalizedLearningRoadmapAction] Query error:", compErr.message);
  }

  if (!studentComps || studentComps.length === 0) {
    return {
      success: false,
      disclaimer:
        "This AI-generated roadmap is personalized pedagogical guidance designed to support your self-directed study and faculty mentorship.",
      evaluatedAt: new Date().toISOString(),
      error:
        "No completed competency assessments found. Please complete a skill assessment to generate your personalized learning roadmap.",
    };
  }

  // 3. Construct de-identified student competency profile
  const mappedCompetencies: DeidentifiedStudentCompetencyProfile["competencies"] = [];

  for (const sc of studentComps as any[]) {
    const comp = Array.isArray(sc.competencies) ? sc.competencies[0] : sc.competencies;
    if (comp) {
      mappedCompetencies.push({
        id: comp.id,
        name: comp.name,
        category: comp.category as CompetencyCategory,
        score: Number(sc.proficiency_score) || 0,
        description: comp.description,
      });
    }
  }

  const studentProfile: DeidentifiedStudentCompetencyProfile = {
    discipline: profile?.department || "Ayurvedic Medicine & Surgery",
    program: profile?.program || "BAMS / MD",
    year: profile?.year || null,
    competencies: mappedCompetencies,
  };

  // 4. Generate AI roadmap
  return generatePersonalizedLearningRoadmap(studentProfile);
}

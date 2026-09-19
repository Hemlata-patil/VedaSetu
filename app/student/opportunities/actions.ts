"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  calculateOpportunitySkillMatch,
  OpportunityCompetencyRequirement,
} from "@/lib/opportunities";
import {
  generateOpportunityInsights,
  CandidateOpportunityForAi,
  DeidentifiedStudentContext,
  GenerateOpportunityInsightsResult,
} from "@/lib/ai/opportunity-insights";

/**
 * Server action to generate personalized AI insights for industry/academic opportunities
 * using Groq (qwen/qwen3.8-27b) and verified Supabase competency records.
 *
 * @param specificOpportunityId Optional ID if generating insights for a single opportunity detail page.
 */
export async function getOpportunityAiInsightsAction(
  specificOpportunityId?: string
): Promise<GenerateOpportunityInsightsResult> {
  // 1. Authenticate student on the server
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 2. Fetch student's assessed competencies
  const { data: studentComps, error: compErr } = await supabase
    .from("student_competencies")
    .select(`
      competency_id,
      proficiency_score,
      competencies (
        id,
        name,
        category
      )
    `)
    .eq("student_id", user.id);

  if (compErr) {
    console.error("[getOpportunityAiInsightsAction] Failed to fetch student competencies:", compErr.message);
  }

  const studentScoresMap = new Map<string, number>();
  const deidentifiedCompetencies: Array<{ name: string; category: string; score: number }> = [];

  if (studentComps) {
    for (const sc of studentComps as any[]) {
      const score = Number(sc.proficiency_score);
      studentScoresMap.set(sc.competency_id, score);
      if (sc.competencies) {
        deidentifiedCompetencies.push({
          name: sc.competencies.name,
          category: sc.competencies.category,
          score,
        });
      }
    }
  }

  // 3. Fetch published opportunities with requirements
  let query = supabase
    .from("opportunities")
    .select(`
      id,
      title,
      description,
      opportunity_type,
      location,
      work_mode,
      eligibility,
      application_deadline,
      status,
      created_at,
      opportunity_competencies (
        competency_id,
        required_score,
        weight,
        competencies (
          id,
          name,
          category
        )
      )
    `)
    .eq("status", "published");

  if (specificOpportunityId) {
    query = query.eq("id", specificOpportunityId);
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: opportunities, error: oppErr } = await query;

  if (oppErr || !opportunities || opportunities.length === 0) {
    return {
      success: true,
      summary: specificOpportunityId
        ? "The requested opportunity was not found or is no longer published."
        : "No active published opportunities were found to evaluate.",
      insights: {},
      disclaimer:
        "AI-generated insights provide educational guidance and pedagogical advice. They do not guarantee selection or override official institutional eligibility criteria.",
      evaluatedAt: new Date().toISOString(),
    };
  }

  // 4. Calculate deterministic match for each opportunity
  const candidatesWithMatch: Array<{
    opp: any;
    matchPercentage: number;
    hasRequirements: boolean;
    candidateForAi: CandidateOpportunityForAi;
  }> = [];

  for (const opp of opportunities) {
    const rawReqs = (opp as any).opportunity_competencies || [];
    const requirements: OpportunityCompetencyRequirement[] = rawReqs
      .filter((r: any) => r.competencies)
      .map((r: any) => ({
        competencyId: r.competency_id,
        competencyName: r.competencies.name,
        category: r.competencies.category,
        requiredScore: Number(r.required_score) || 60,
        weight: Number(r.weight) || 1,
      }));

    const matchResult = calculateOpportunitySkillMatch(requirements, studentScoresMap);

    const candidateForAi: CandidateOpportunityForAi = {
      id: opp.id,
      title: opp.title,
      type: opp.opportunity_type || "internship",
      workMode: opp.work_mode,
      eligibility: opp.eligibility,
      deterministicMatchPercentage: matchResult.skillMatchPercentage,
      requirements: matchResult.details.map((d) => ({
        name: d.competencyName,
        category: d.category,
        requiredScore: d.requiredScore,
        studentScore: d.studentScore,
        status: d.status,
      })),
      skillGapsCount: matchResult.skillGaps.length,
    };

    candidatesWithMatch.push({
      opp,
      matchPercentage: matchResult.skillMatchPercentage ?? 0,
      hasRequirements: matchResult.hasRequirements,
      candidateForAi,
    });
  }

  // 5. Select top candidates to limit token consumption (max 5)
  // If specificOpportunityId was passed, take that 1 opportunity.
  // Otherwise, sort by match percentage descending and take top 5.
  let selectedCandidates: CandidateOpportunityForAi[] = [];
  if (specificOpportunityId) {
    selectedCandidates = candidatesWithMatch.slice(0, 1).map((c) => c.candidateForAi);
  } else {
    candidatesWithMatch.sort((a, b) => b.matchPercentage - a.matchPercentage);
    selectedCandidates = candidatesWithMatch.slice(0, 5).map((c) => c.candidateForAi);
  }

  // 6. Build de-identified student context
  const studentContext: DeidentifiedStudentContext = {
    discipline: profile?.department || "Ayurvedic Medicine & Surgery",
    program: profile?.program || "BAMS / MD",
    year: profile?.year || null,
    competencies: deidentifiedCompetencies,
  };

  // 7. Invoke Groq AI insights generator
  return generateOpportunityInsights(studentContext, selectedCandidates);
}

import "server-only";
import { getGroqClient, GROQ_MODELS } from "@/lib/ai/groq";

/**
 * De-identified student context for AYUSH opportunity insights.
 * Explicitly excludes names, emails, user IDs, patient data, and clinical cases.
 */
export interface DeidentifiedStudentContext {
  discipline?: string | null;
  program?: string | null;
  year?: number | null;
  competencies: Array<{
    name: string;
    category: string;
    score: number;
  }>;
}

/**
 * Candidate opportunity representation for AI reasoning.
 */
export interface CandidateOpportunityForAi {
  id: string;
  title: string;
  type: string;
  workMode?: string | null;
  eligibility?: string | null;
  deterministicMatchPercentage: number | null;
  requirements: Array<{
    name: string;
    category: string;
    requiredScore: number;
    studentScore: number | null;
    status: "Met" | "Development Needed" | "Not Assessed";
  }>;
  skillGapsCount: number;
}

/**
 * Validated AI Insight for a single opportunity.
 */
export interface OpportunityAiInsight {
  opportunityId: string;
  whyItMayMatch: string;
  relevantCompetencies: string[];
  skillGaps: string[];
  suggestedNextSteps: string[];
}

/**
 * Overall response from the AI opportunity insights service.
 */
export interface GenerateOpportunityInsightsResult {
  success: boolean;
  summary?: string;
  insights: Record<string, OpportunityAiInsight>;
  disclaimer: string;
  error?: string;
  evaluatedAt: string;
}

const AI_DISCLAIMER =
  "AI-generated insights provide educational guidance and pedagogical advice. They do not guarantee selection or override official institutional eligibility criteria.";

/**
 * Sanitizes untrusted text string to avoid control characters or excessive length.
 */
function sanitizeText(val: unknown, maxLength = 350): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitizes an array of string items.
 */
function sanitizeStringArray(arr: unknown, maxItems = 5, itemMaxLength = 160): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, itemMaxLength));
}

/**
 * Validates raw LLM response against the strictly allowed candidate opportunity IDs.
 * Rejects any hallucinated or unknown IDs.
 */
export function validateAndSanitizeAiResponse(
  rawJson: unknown,
  allowedCandidateIds: Set<string>
): {
  summary: string;
  insights: Record<string, OpportunityAiInsight>;
} {
  const insights: Record<string, OpportunityAiInsight> = {};
  let summary = "";

  if (!rawJson || typeof rawJson !== "object") {
    return { summary, insights };
  }

  const obj = rawJson as Record<string, any>;
  summary = sanitizeText(obj.summary, 400);

  const rawInsights = Array.isArray(obj.insights) ? obj.insights : [];

  for (const item of rawInsights) {
    if (!item || typeof item !== "object") continue;

    const oppId = typeof item.opportunity_id === "string" ? item.opportunity_id.trim() : "";

    // STRICT VALIDATION: Reject any opportunity_id not in allowedCandidateIds
    if (!oppId || !allowedCandidateIds.has(oppId)) {
      continue;
    }

    const whyItMayMatch = sanitizeText(item.why_it_may_match, 350);
    const relevantCompetencies = sanitizeStringArray(item.relevant_competencies, 5);
    const skillGaps = sanitizeStringArray(item.skill_gaps, 5);
    const suggestedNextSteps = sanitizeStringArray(item.suggested_next_steps, 5);

    // Only accept if meaningful reasoning is provided
    if (whyItMayMatch) {
      insights[oppId] = {
        opportunityId: oppId,
        whyItMayMatch,
        relevantCompetencies,
        skillGaps,
        suggestedNextSteps,
      };
    }
  }

  return { summary, insights };
}

/**
 * Generates personalized, AYUSH-specific insights for candidate opportunities using Groq AI.
 * Strict de-identification: NO names, emails, UUIDs, or clinical case records are sent.
 */
export async function generateOpportunityInsights(
  studentContext: DeidentifiedStudentContext,
  candidateOpportunities: CandidateOpportunityForAi[]
): Promise<GenerateOpportunityInsightsResult> {
  const evaluatedAt = new Date().toISOString();

  if (!candidateOpportunities || candidateOpportunities.length === 0) {
    return {
      success: true,
      summary: "No published opportunities available for evaluation at this time.",
      insights: {},
      disclaimer: AI_DISCLAIMER,
      evaluatedAt,
    };
  }

  // Build the set of valid IDs for rejection filter
  const allowedIds = new Set(candidateOpportunities.map((o) => o.id));

  // If student has zero assessed competencies, return a friendly guidance without consuming tokens
  if (!studentContext.competencies || studentContext.competencies.length === 0) {
    return {
      success: true,
      summary:
        "You have not completed any competency assessments yet. Complete skill assessments in your student dashboard to unlock personalized AYUSH opportunity matching and gap analysis.",
      insights: {},
      disclaimer: AI_DISCLAIMER,
      evaluatedAt,
    };
  }

  try {
    const groq = getGroqClient();

    const systemPrompt = `You are Veda Setu's Senior AYUSH Academia-Industry Advisory Engine.
Your role is to analyze a student's assessed AYUSH competencies against industry/academic opportunity requirements and provide concise, pedagogical guidance.

CRITICAL CONSTRAINTS:
1. You must ONLY output a single valid JSON object. Do not include markdown code blocks, backticks, or commentary outside the JSON.
2. You must ONLY reference the exact "opportunity_id" values provided in the prompt. NEVER invent new opportunity IDs, dates, organizations, or eligibility criteria.
3. Keep explanations grounded in AYUSH principles (e.g. Ayurveda, Yoga, Unani, Siddha, Homeopathy, clinical competencies, pharmacology/Dravyaguna, diagnostics/Nidana, or integrative research).
4. For each opportunity, provide:
   - "opportunity_id": string (must match an input ID)
   - "why_it_may_match": string (1-2 sentences on how the student's background aligns)
   - "relevant_competencies": array of strings (key strengths)
   - "skill_gaps": array of strings (areas needing improvement)
   - "suggested_next_steps": array of strings (1-3 actionable study or practice recommendations)
5. Include a top-level "summary" field (2-3 sentences of overall strategic academic guidance).

JSON Schema:
{
  "summary": "Overall guidance for the student...",
  "insights": [
    {
      "opportunity_id": "opp_id_here",
      "why_it_may_match": "...",
      "relevant_competencies": ["..."],
      "skill_gaps": ["..."],
      "suggested_next_steps": ["..."]
    }
  ]
}`;

    const userPayload = {
      student_profile: {
        discipline: studentContext.discipline || "AYUSH General",
        program: studentContext.program || "Undergraduate / Postgraduate",
        year: studentContext.year ? `Year ${studentContext.year}` : "Current Scholar",
        assessed_competencies: studentContext.competencies.slice(0, 15),
      },
      candidate_opportunities: candidateOpportunities.map((opp) => ({
        opportunity_id: opp.id,
        title: opp.title,
        opportunity_type: opp.type,
        work_mode: opp.workMode,
        deterministic_match_percentage: opp.deterministicMatchPercentage,
        requirements: opp.requirements,
      })),
    };

    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze these candidate opportunities against the student's competency profile:\n${JSON.stringify(
            userPayload,
            null,
            2
          )}`,
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "{}";

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      // Fallback: strip possible markdown formatting if present
      const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsedJson = JSON.parse(cleaned);
    }

    const { summary, insights } = validateAndSanitizeAiResponse(parsedJson, allowedIds);

    return {
      success: true,
      summary: summary || "AI match evaluation completed based on your verified competency profile.",
      insights,
      disclaimer: AI_DISCLAIMER,
      evaluatedAt,
    };
  } catch (err: any) {
    // Graceful fallback: Do not break the UI or expose internal API errors/keys
    console.error("[Groq Opportunity Insights] Execution error:", err?.message || err);
    return {
      success: false,
      summary: undefined,
      insights: {},
      disclaimer: AI_DISCLAIMER,
      error: "AI Opportunity Insights are temporarily unavailable. Deterministic skill matching remains active.",
      evaluatedAt,
    };
  }
}

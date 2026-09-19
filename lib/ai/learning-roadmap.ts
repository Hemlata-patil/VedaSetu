import "server-only";
import { getGroqClient, GROQ_MODELS } from "@/lib/ai/groq";
import { CompetencyCategory } from "@/lib/competencies";

export interface DeidentifiedStudentCompetencyProfile {
  discipline?: string | null;
  program?: string | null;
  year?: number | null;
  competencies: Array<{
    id: string;
    name: string;
    category: CompetencyCategory;
    score: number;
    description?: string | null;
  }>;
}

export interface AiRoadmapPhase {
  phaseNumber: number;
  title: string;
  suggestedDuration: string;
  focusSummary: string;
  learningActivities: string[];
  practicalExercises: string[];
  milestones: string[];
}

export interface AiCompetencyFocusItem {
  competencyName: string;
  score: number;
  category: string;
  rationale: string;
  targetFocus: string;
}

export interface AiPersonalizedRoadmap {
  personalizedGoal: string;
  keyStrengths: Array<{
    competencyName: string;
    score: number;
    summary: string;
  }>;
  priorityGaps: AiCompetencyFocusItem[];
  phases: AiRoadmapPhase[];
  reassessmentFocus: string[];
  suggestedTimelineMonths: number;
}

export interface GenerateLearningRoadmapResult {
  success: boolean;
  roadmap?: AiPersonalizedRoadmap;
  disclaimer: string;
  evaluatedAt: string;
  error?: string;
}

const ROADMAP_DISCLAIMER =
  "This AI-generated roadmap is personalized pedagogical guidance designed to support your self-directed study and faculty mentorship. It does not represent mandatory NCISM curricular requirements.";

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
function sanitizeStringArray(arr: unknown, maxItems = 4, itemMaxLength = 200): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, itemMaxLength));
}

/**
 * Validates and sanitizes raw JSON output from Groq into a strict AiPersonalizedRoadmap.
 */
export function validateAndSanitizeRoadmapResponse(
  rawJson: unknown,
  allowedCompetencyMap: Map<string, { score: number; category: string }>
): AiPersonalizedRoadmap | null {
  if (!rawJson || typeof rawJson !== "object") {
    return null;
  }

  const obj = rawJson as Record<string, any>;
  const personalizedGoal = sanitizeText(
    obj.personalized_goal || obj.learning_goal || obj.goal || obj.summary,
    400
  );

  if (!personalizedGoal) {
    return null;
  }

  // Create case-insensitive lookup map
  const normalizedMap = new Map<string, { canonicalName: string; score: number; category: string }>();
  for (const [name, val] of allowedCompetencyMap.entries()) {
    normalizedMap.set(name.toLowerCase().trim(), {
      canonicalName: name,
      score: val.score,
      category: val.category,
    });
  }

  // 1. Process Strengths
  const rawStrengths = Array.isArray(obj.key_strengths)
    ? obj.key_strengths
    : Array.isArray(obj.strengths)
    ? obj.strengths
    : [];
  const keyStrengths: AiPersonalizedRoadmap["keyStrengths"] = [];

  for (const item of rawStrengths) {
    if (!item || typeof item !== "object") continue;
    const rawName = sanitizeText(item.competency_name || item.name || item.competency, 100);
    const summary = sanitizeText(item.summary || item.rationale || item.description || item.explanation, 250);

    const matched = normalizedMap.get(rawName.toLowerCase().trim());
    if (matched && summary) {
      keyStrengths.push({
        competencyName: matched.canonicalName,
        score: matched.score,
        summary,
      });
    }
  }

  // 2. Process Priority Gaps
  const rawGaps = Array.isArray(obj.priority_gaps)
    ? obj.priority_gaps
    : Array.isArray(obj.focus_areas)
    ? obj.focus_areas
    : Array.isArray(obj.skill_gaps)
    ? obj.skill_gaps
    : [];
  const priorityGaps: AiCompetencyFocusItem[] = [];

  for (const item of rawGaps) {
    if (!item || typeof item !== "object") continue;
    const rawName = sanitizeText(item.competency_name || item.name || item.competency, 100);
    const rationale = sanitizeText(item.rationale || item.summary || item.description || item.why_it_matters, 250);
    const targetFocus = sanitizeText(item.target_focus || item.focus || item.focus_area || item.action, 250);

    const matched = normalizedMap.get(rawName.toLowerCase().trim());
    if (matched && rationale) {
      priorityGaps.push({
        competencyName: matched.canonicalName,
        score: matched.score,
        category: matched.category,
        rationale,
        targetFocus: targetFocus || "Targeted practice and conceptual review.",
      });
    }
  }

  // 3. Process Phases
  const rawPhases = Array.isArray(obj.phases)
    ? obj.phases
    : Array.isArray(obj.learning_phases)
    ? obj.learning_phases
    : [];
  const phases: AiRoadmapPhase[] = [];

  for (let i = 0; i < Math.min(rawPhases.length, 3); i++) {
    const p = rawPhases[i];
    if (!p || typeof p !== "object") continue;

    const phaseNumber = Number(p.phase_number || p.phase) || i + 1;
    const title = sanitizeText(p.title || p.phase_title, 120) || `Phase ${phaseNumber}: Competency Development`;
    const suggestedDuration = sanitizeText(p.suggested_duration || p.duration || p.timeline, 50) || "Weeks 1-4";
    const focusSummary = sanitizeText(p.focus_summary || p.summary || p.focus || p.description, 300);
    const learningActivities = sanitizeStringArray(p.learning_activities || p.activities || p.study_tasks, 4, 200);
    const practicalExercises = sanitizeStringArray(p.practical_exercises || p.exercises || p.clinical_tasks, 4, 200);
    const milestones = sanitizeStringArray(p.milestones || p.outcomes || p.completion_criteria, 4, 200);

    phases.push({
      phaseNumber,
      title,
      suggestedDuration,
      focusSummary,
      learningActivities,
      practicalExercises,
      milestones,
    });
  }

  if (phases.length === 0) {
    return null;
  }

  // 4. Reassessment focus & timeline
  const reassessmentFocus = sanitizeStringArray(obj.reassessment_focus || obj.reassessment_milestones, 4, 150);
  const suggestedTimelineMonths = Math.min(
    12,
    Math.max(1, Number(obj.suggested_timeline_months || obj.timeline_months) || 3)
  );

  return {
    personalizedGoal,
    keyStrengths: keyStrengths.slice(0, 3),
    priorityGaps: priorityGaps.slice(0, 4),
    phases,
    reassessmentFocus,
    suggestedTimelineMonths,
  };
}

/**
 * Generates an AYUSH-specific personalized learning roadmap using Groq (qwen/qwen3.8-27b).
 * Strict de-identification: NO names, emails, UUIDs, or patient data are sent.
 */
export async function generatePersonalizedLearningRoadmap(
  studentProfile: DeidentifiedStudentCompetencyProfile
): Promise<GenerateLearningRoadmapResult> {
  const evaluatedAt = new Date().toISOString();

  if (!studentProfile.competencies || studentProfile.competencies.length === 0) {
    return {
      success: false,
      disclaimer: ROADMAP_DISCLAIMER,
      evaluatedAt,
      error:
        "No completed competency assessments found. Please complete a skill assessment to generate your personalized learning roadmap.",
    };
  }

  // Build lookup map of allowed competency names
  const allowedMap = new Map<string, { score: number; category: string }>();
  for (const c of studentProfile.competencies) {
    allowedMap.set(c.name, { score: c.score, category: c.category });
  }

  try {
    const groq = getGroqClient();

    const systemPrompt = `You are Veda Setu's Chief AYUSH Pedagogical & Clinical Competency Advisor.
Your role is to analyze a student's assessed AYUSH competencies and construct an actionable, structured, 3-phase personalized learning roadmap.

CRITICAL INSTRUCTIONS & CONSTRAINTS:
1. Output ONLY a single valid JSON object matching the schema below. No markdown backticks, explanations, or text outside the JSON.
2. Ground all guidance strictly in AYUSH academic & clinical disciplines (Ayurveda, Dravyaguna, Panchakarma, Rogi Pariksha, Samhita study, modern clinical integration, or research biostatistics).
3. Connect recommendations directly to the student's actual assessed competencies and their scores.
4. ONLY reference competency names that are present in the provided competency list. Do NOT invent new competency names.
5. Do NOT invent official university course titles, certifications, external URLs, or unauthorized institution requirements.
6. Provide exactly 3 progressive phases:
   - Phase 1: Foundational Strengthening (classical literature review, theoretical frameworks, conceptual synthesis)
   - Phase 2: Clinical & Practical Application (case workups, supervised rounds, simulation, protocol drafting)
   - Phase 3: Evidence & Demonstration (case presentations, clinical audit, peer discussions, milestone demonstration)

JSON Output Schema:
{
  "personalized_goal": "Concise 1-2 sentence overarching learning goal tailored to their AYUSH discipline and year",
  "suggested_timeline_months": 3,
  "key_strengths": [
    {
      "competency_name": "Exact Name From List",
      "summary": "1 sentence on how to leverage this high proficiency"
    }
  ],
  "priority_gaps": [
    {
      "competency_name": "Exact Name From List",
      "rationale": "1 sentence explaining why bridging this gap is vital",
      "target_focus": "Specific AYUSH topic/clinical area to concentrate on"
    }
  ],
  "phases": [
    {
      "phase_number": 1,
      "title": "Phase 1: Foundational Strengthening",
      "suggested_duration": "Weeks 1-4",
      "focus_summary": "1 sentence summary of phase focus",
      "learning_activities": ["Activity 1", "Activity 2"],
      "practical_exercises": ["Exercise 1", "Exercise 2"],
      "milestones": ["Milestone 1", "Milestone 2"]
    },
    {
      "phase_number": 2,
      "title": "Phase 2: Practice & Clinical Application",
      "suggested_duration": "Weeks 5-8",
      "focus_summary": "...",
      "learning_activities": ["..."],
      "practical_exercises": ["..."],
      "milestones": ["..."]
    },
    {
      "phase_number": 3,
      "title": "Phase 3: Evidence & Demonstration",
      "suggested_duration": "Weeks 9-12",
      "focus_summary": "...",
      "learning_activities": ["..."],
      "practical_exercises": ["..."],
      "milestones": ["..."]
    }
  ],
  "reassessment_focus": [
    "Suggested competency to reassess after Phase 1",
    "Suggested competency to reassess after Phase 2"
  ]
}`;

    const userPayload = {
      student_academic_profile: {
        discipline: studentProfile.discipline || "Ayurvedic Medicine & Surgery",
        program: studentProfile.program || "Undergraduate / Postgraduate",
        year: studentProfile.year ? `Year ${studentProfile.year}` : "Active Scholar",
      },
      assessed_competencies: studentProfile.competencies.map((c) => ({
        competency_name: c.name,
        category: c.category,
        proficiency_score: c.score,
        benchmark_met: c.score >= 60,
      })),
    };

    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate a personalized learning roadmap for this AYUSH student:\n${JSON.stringify(
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
      const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsedJson = JSON.parse(cleaned);
    }

    const validatedRoadmap = validateAndSanitizeRoadmapResponse(parsedJson, allowedMap);

    if (!validatedRoadmap) {
      throw new Error("AI roadmap response did not pass schema validation.");
    }

    return {
      success: true,
      roadmap: validatedRoadmap,
      disclaimer: ROADMAP_DISCLAIMER,
      evaluatedAt,
    };
  } catch (err: any) {
    console.error("[Groq Learning Roadmap] Execution error:", err?.message || err);
    return {
      success: false,
      disclaimer: ROADMAP_DISCLAIMER,
      evaluatedAt,
      error:
        "AI Learning Roadmap is temporarily unavailable. Standard platform guidance remains active below.",
    };
  }
}

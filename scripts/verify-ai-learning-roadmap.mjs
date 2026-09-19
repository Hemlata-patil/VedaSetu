import fs from "fs";
import Groq from "groq-sdk";

// 1. Load env safely without printing secrets
const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
});

const GROQ_API_KEY = env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ FAILED: GROQ_API_KEY is not defined in .env.local");
  process.exit(1);
}

console.log("=== VEDA SETU AI PERSONALIZED LEARNING ROADMAP VERIFICATION ===");

// --- TEST 1: Pure Validation & Hallucination Defense Unit Tests ---
console.log("\n[TEST 1] Roadmap Validation & Hallucination Rejection Unit Tests");

function sanitizeText(val, maxLength = 350) {
  if (typeof val !== "string") return "";
  return val
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeStringArray(arr, maxItems = 4, itemMaxLength = 200) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, itemMaxLength));
}

function validateAndSanitizeRoadmapResponse(rawJson, allowedCompetencyMap) {
  if (!rawJson || typeof rawJson !== "object") {
    return null;
  }

  const personalizedGoal = sanitizeText(
    rawJson.personalized_goal || rawJson.learning_goal || rawJson.goal || rawJson.summary,
    400
  );
  if (!personalizedGoal) {
    return null;
  }

  // Create case-insensitive lookup map
  const normalizedMap = new Map();
  for (const [name, val] of allowedCompetencyMap.entries()) {
    normalizedMap.set(name.toLowerCase().trim(), {
      canonicalName: name,
      score: val.score,
      category: val.category,
    });
  }

  // 1. Process Strengths
  const rawStrengths = Array.isArray(rawJson.key_strengths)
    ? rawJson.key_strengths
    : Array.isArray(rawJson.strengths)
    ? rawJson.strengths
    : [];
  const keyStrengths = [];

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
  const rawGaps = Array.isArray(rawJson.priority_gaps)
    ? rawJson.priority_gaps
    : Array.isArray(rawJson.focus_areas)
    ? rawJson.focus_areas
    : Array.isArray(rawJson.skill_gaps)
    ? rawJson.skill_gaps
    : [];
  const priorityGaps = [];

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
  const rawPhases = Array.isArray(rawJson.phases)
    ? rawJson.phases
    : Array.isArray(rawJson.learning_phases)
    ? rawJson.learning_phases
    : [];
  const phases = [];

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

  const reassessmentFocus = sanitizeStringArray(rawJson.reassessment_focus || rawJson.reassessment_milestones, 4, 150);
  const suggestedTimelineMonths = Math.min(
    12,
    Math.max(1, Number(rawJson.suggested_timeline_months || rawJson.timeline_months) || 3)
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

const allowedMap = new Map([
  ["Dravyaguna Identification", { score: 85, category: "academic_domain" }],
  ["Clinical Diagnosis", { score: 78, category: "clinical_practical" }],
  ["Biostatistics & Research", { score: 42, category: "research" }],
  ["Panchakarma Protocol Planning", { score: 48, category: "clinical_practical" }],
]);

const syntheticModelOutput = {
  personalized_goal: "Strengthen research methodology and clinical Panchakarma planning while leveraging pharmacological strengths.",
  suggested_timeline_months: 3,
  key_strengths: [
    {
      competency_name: "Dravyaguna Identification",
      summary: "Leverage advanced herbal knowledge during formulation selection.",
    },
    {
      // HALLUCINATED COMPETENCY - MUST BE REJECTED
      competency_name: "Invented Modern Surgery",
      summary: "Should be dropped by validation filter.",
    },
  ],
  priority_gaps: [
    {
      competency_name: "Biostatistics & Research",
      rationale: "Essential for interpreting clinical trial data and publishing evidence.",
      target_focus: "Descriptive statistics and p-value interpretation.",
    },
    {
      // HALLUCINATED COMPETENCY - MUST BE REJECTED
      competency_name: "Fake Machine Learning",
      rationale: "Should be dropped.",
      target_focus: "None",
    },
  ],
  phases: [
    {
      phase_number: 1,
      title: "Phase 1: Foundational Literature & Biostatistical Review",
      suggested_duration: "Weeks 1-4",
      focus_summary: "Review classical texts and introductory biostatistics.",
      learning_activities: ["Read Charaka Samhita Sutrasthana", "Complete biostatistics tutorial"],
      practical_exercises: ["Analyze sample clinical study"],
      milestones: ["Score 70%+ on research self-assessment"],
    },
  ],
  reassessment_focus: ["Biostatistics & Research", "Panchakarma Protocol Planning"],
};

const validated = validateAndSanitizeRoadmapResponse(syntheticModelOutput, allowedMap);

if (
  validated &&
  validated.keyStrengths.length === 1 &&
  validated.keyStrengths[0].competencyName === "Dravyaguna Identification" &&
  validated.priorityGaps.length === 1 &&
  validated.priorityGaps[0].competencyName === "Biostatistics & Research" &&
  validated.phases.length === 1
) {
  console.log("  ✅ PASS: Valid competency references retained; hallucinated competencies strictly rejected.");
} else {
  console.error("  ❌ FAIL: Competency filter failed:", validated);
  process.exit(1);
}

// Malformed input test
const malformedCheck = validateAndSanitizeRoadmapResponse("malformed non-object", allowedMap);
if (malformedCheck === null) {
  console.log("  ✅ PASS: Malformed response safely returns null.");
} else {
  console.error("  ❌ FAIL: Malformed response was not rejected.");
  process.exit(1);
}

// Missing goal test
const missingGoalCheck = validateAndSanitizeRoadmapResponse({ key_strengths: [] }, allowedMap);
if (missingGoalCheck === null) {
  console.log("  ✅ PASS: Missing personalized goal safely returns null.");
} else {
  console.error("  ❌ FAIL: Missing goal was not rejected.");
  process.exit(1);
}

// --- TEST 2: Live Single Groq AI Request (qwen/qwen3.8-27b) ---
console.log("\n[TEST 2] Live Single Groq AI Roadmap Generation (qwen/qwen3.8-27b)");

async function testLiveRoadmapCall() {
  const groq = new Groq({ apiKey: GROQ_API_KEY });

  const deidentifiedStudentPayload = {
    student_academic_profile: {
      discipline: "Ayurvedic Medicine & Surgery",
      program: "BAMS",
      year: "Year 3",
    },
    assessed_competencies: [
      { competency_name: "Dravyaguna Identification", category: "academic_domain", proficiency_score: 85, benchmark_met: true },
      { competency_name: "Clinical Diagnosis", category: "clinical_practical", proficiency_score: 78, benchmark_met: true },
      { competency_name: "Biostatistics & Research", category: "research", proficiency_score: 42, benchmark_met: false },
      { competency_name: "Panchakarma Protocol Planning", category: "clinical_practical", proficiency_score: 48, benchmark_met: false },
    ],
  };

  const systemPrompt = `You are Veda Setu's Chief AYUSH Pedagogical & Clinical Competency Advisor.
Your role is to analyze a student's assessed AYUSH competencies and construct an actionable, structured, 3-phase personalized learning roadmap.

CRITICAL INSTRUCTIONS & CONSTRAINTS:
1. Output ONLY a single valid JSON object matching the schema below. No markdown backticks, explanations, or text outside the JSON.
2. Ground all guidance strictly in AYUSH academic & clinical disciplines.
3. Connect recommendations directly to the student's actual assessed competencies and their scores.
4. ONLY reference competency names that are present in the provided competency list. Do NOT invent new competency names.
5. Provide exactly 3 progressive phases.

JSON Output Schema:
{
  "personalized_goal": "...",
  "suggested_timeline_months": 3,
  "key_strengths": [
    {
      "competency_name": "Exact Name From List",
      "summary": "..."
    }
  ],
  "priority_gaps": [
    {
      "competency_name": "Exact Name From List",
      "rationale": "...",
      "target_focus": "..."
    }
  ],
  "phases": [
    {
      "phase_number": 1,
      "title": "Phase 1: Foundational Strengthening",
      "suggested_duration": "Weeks 1-4",
      "focus_summary": "...",
      "learning_activities": ["..."],
      "practical_exercises": ["..."],
      "milestones": ["..."]
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

  console.log("  Sending de-identified payload to Groq model: qwen/qwen3.8-27b...");
  const completion = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate a personalized learning roadmap for this AYUSH student:\n${JSON.stringify(
          deidentifiedStudentPayload,
          null,
          2
        )}`,
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const rawContent = completion.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error("Empty response returned by Groq");
  }

  const parsed = JSON.parse(rawContent);
  const result = validateAndSanitizeRoadmapResponse(parsed, allowedMap);

  if (!result || result.phases.length < 3) {
    throw new Error("Validation failed or fewer than 3 phases returned");
  }

  console.log("  ✅ Groq Response Received and Parsed Successfully!");
  console.log("  Personalized Goal:", result.personalizedGoal);
  console.log("  Key Strengths Identified:", result.keyStrengths.map((s) => `${s.competencyName} (${s.score}%)`));
  console.log("  Priority Gaps Identified:", result.priorityGaps.map((g) => `${g.competencyName} (${g.score}%)`));
  console.log("  Phases Generated:", result.phases.map((p) => `${p.title} (${p.suggestedDuration})`));
  console.log("  Reassessment Focus:", result.reassessmentFocus);

  console.log("\n🎉 ALL TESTS PASSED: Groq AYUSH Personalized Learning Roadmap is fully operational!");
}

testLiveRoadmapCall().catch((err) => {
  console.error("❌ Live test failed:", err);
  process.exit(1);
});

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

console.log("=== VEDA SETU AI OPPORTUNITY INSIGHTS VERIFICATION ===");

// --- TEST 1: Pure Validation & Hallucination Rejection ---
console.log("\n[TEST 1] Validation & Hallucination Rejection Unit Tests");

function sanitizeText(val, maxLength = 350) {
  if (typeof val !== "string") return "";
  return val
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeStringArray(arr, maxItems = 5, itemMaxLength = 160) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, itemMaxLength));
}

function validateAndSanitizeAiResponse(rawJson, allowedCandidateIds) {
  const insights = {};
  let summary = "";

  if (!rawJson || typeof rawJson !== "object") {
    return { summary, insights };
  }

  summary = sanitizeText(rawJson.summary, 400);
  const rawInsights = Array.isArray(rawJson.insights) ? rawJson.insights : [];

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

const realCandidateId1 = "00000000-0000-0000-0000-000000000001";
const realCandidateId2 = "00000000-0000-0000-0000-000000000002";
const allowedIds = new Set([realCandidateId1, realCandidateId2]);

const syntheticModelOutput = {
  summary: "Strong candidate for clinical research in Dravyaguna.",
  insights: [
    {
      opportunity_id: realCandidateId1,
      why_it_may_match: "Student has high proficiency in Ayurvedic pharmacology.",
      relevant_competencies: ["Dravyaguna Identification", "Rasa Shastra"],
      skill_gaps: ["Clinical Documentation"],
      suggested_next_steps: ["Review Charaka Samhita Chikitsa Sthana"],
    },
    {
      // HALLUCINATED ID - MUST BE REJECTED
      opportunity_id: "hallucinated-opp-id-9999",
      why_it_may_match: "This is a fake opportunity invented by LLM.",
      relevant_competencies: ["Fake Competency"],
      skill_gaps: [],
      suggested_next_steps: [],
    },
    {
      opportunity_id: realCandidateId2,
      why_it_may_match: "Good match for Panchakarma clinical apprenticeship.",
      relevant_competencies: ["Panchakarma Procedures"],
      skill_gaps: [],
      suggested_next_steps: ["Attend practical clinical rotation"],
    },
  ],
};

const validationResult = validateAndSanitizeAiResponse(syntheticModelOutput, allowedIds);

if (
  validationResult.insights[realCandidateId1] &&
  validationResult.insights[realCandidateId2] &&
  !validationResult.insights["hallucinated-opp-id-9999"] &&
  Object.keys(validationResult.insights).length === 2
) {
  console.log("  ✅ PASS: Allowed candidate IDs accepted, hallucinated ID strictly rejected.");
} else {
  console.error("  ❌ FAIL: Hallucination filter failed:", validationResult);
  process.exit(1);
}

// Test malformed payload
const malformedResult = validateAndSanitizeAiResponse("invalid non-object json", allowedIds);
if (malformedResult.summary === "" && Object.keys(malformedResult.insights).length === 0) {
  console.log("  ✅ PASS: Malformed response gracefully handled with empty fallback.");
} else {
  console.error("  ❌ FAIL: Malformed response was not handled safely.");
  process.exit(1);
}

// --- TEST 2: Live De-identified Groq Integration Call ---
console.log("\n[TEST 2] Live Single Groq AI Request (qwen/qwen3.8-27b)");

async function testLiveGroqCall() {
  const groq = new Groq({ apiKey: GROQ_API_KEY });
  const testOppId = "e9b2c3d4-0000-4000-8000-111122223333";
  const validAllowedIds = new Set([testOppId]);

  const deidentifiedPayload = {
    student_profile: {
      discipline: "Ayurvedic Medicine & Surgery",
      program: "BAMS",
      year: "Year 4",
      assessed_competencies: [
        { name: "Ayurvedic Clinical Diagnosis", category: "clinical_practical", score: 85 },
        { name: "Dravyaguna Identification", category: "academic_domain", score: 78 },
        { name: "Panchakarma Protocol Planning", category: "clinical_practical", score: 62 },
      ],
    },
    candidate_opportunities: [
      {
        opportunity_id: testOppId,
        title: "Clinical Research Fellowship in Integrative Ayurveda",
        opportunity_type: "internship",
        work_mode: "hybrid",
        deterministic_match_percentage: 82,
        requirements: [
          {
            name: "Ayurvedic Clinical Diagnosis",
            category: "clinical_practical",
            requiredScore: 70,
            studentScore: 85,
            status: "Met",
          },
          {
            name: "Dravyaguna Identification",
            category: "academic_domain",
            requiredScore: 65,
            studentScore: 78,
            status: "Met",
          },
          {
            name: "Panchakarma Protocol Planning",
            category: "clinical_practical",
            requiredScore: 75,
            studentScore: 62,
            status: "Development Needed",
          },
        ],
      },
    ],
  };

  const systemPrompt = `You are Veda Setu's Senior AYUSH Academia-Industry Advisory Engine.
Your role is to analyze a student's assessed AYUSH competencies against industry/academic opportunity requirements and provide concise, pedagogical guidance.

CRITICAL CONSTRAINTS:
1. You must ONLY output a single valid JSON object. Do not include markdown code blocks, backticks, or commentary outside the JSON.
2. You must ONLY reference the exact "opportunity_id" values provided in the prompt. NEVER invent new opportunity IDs, dates, organizations, or eligibility criteria.
3. Keep explanations grounded in AYUSH principles.
4. For each opportunity, provide:
   - "opportunity_id": string (must match an input ID)
   - "why_it_may_match": string
   - "relevant_competencies": array of strings
   - "skill_gaps": array of strings
   - "suggested_next_steps": array of strings
5. Include a top-level "summary" field.

JSON Schema:
{
  "summary": "...",
  "insights": [
    {
      "opportunity_id": "...",
      "why_it_may_match": "...",
      "relevant_competencies": ["..."],
      "skill_gaps": ["..."],
      "suggested_next_steps": ["..."]
    }
  ]
}`;

  console.log("  Sending de-identified payload to Groq model: qwen/qwen3.8-27b...");
  const completion = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analyze these candidate opportunities against the student's competency profile:\n${JSON.stringify(
          deidentifiedPayload,
          null,
          2
        )}`,
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const rawContent = completion.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error("Empty response returned by Groq");
  }

  const parsed = JSON.parse(rawContent);
  const validated = validateAndSanitizeAiResponse(parsed, validAllowedIds);

  console.log("  ✅ Groq Response Received and Parsed Successfully!");
  console.log("  Summary:", validated.summary);
  console.log("  Insight for", testOppId + ":");
  console.log("    - Why it matches:", validated.insights[testOppId]?.whyItMayMatch);
  console.log("    - Key Strengths:", validated.insights[testOppId]?.relevantCompetencies);
  console.log("    - Next Steps:", validated.insights[testOppId]?.suggestedNextSteps);

  if (!validated.insights[testOppId]) {
    throw new Error("Validation rejected the expected opportunity ID");
  }

  console.log("\n🎉 ALL TESTS PASSED: Groq AYUSH Opportunity Insights integration is fully operational!");
}

testLiveGroqCall().catch((err) => {
  console.error("❌ Live test failed:", err);
  process.exit(1);
});

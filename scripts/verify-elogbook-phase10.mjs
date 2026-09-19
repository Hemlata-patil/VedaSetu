import fs from "fs";
import path from "path";

console.log("===============================================================================");
console.log("  PHASE 10 VERIFICATION: STUDENT E-LOGBOOK SUPABASE PERSISTENCE & SECURITY");
console.log("===============================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
  }
}

// 1. File Architecture Verification
console.log("Test Suite 1: File Architecture & Server Actions");
const filesToCheck = [
  "app/student/elogbook/actions.ts",
  "app/student/elogbook/page.tsx",
  "app/student/elogbook/new/page.tsx",
  "app/student/elogbook/[id]/page.tsx",
  "app/student/elogbook/[id]/edit/page.tsx",
  "components/elogbook/case-list.tsx",
  "components/elogbook/case-form.tsx",
  "components/elogbook/case-detail.tsx",
  "components/elogbook/terminology-search.tsx",
  "supabase/migrations/drafts/20260919_phase5_elogbook_final_proposal.sql",
];

filesToCheck.forEach((relPath) => {
  const fullPath = path.resolve(relPath);
  assert(fs.existsSync(fullPath), `Required file exists: ${relPath}`);
});

// 2. Server Action Security & Trusted Identity Derivation
console.log("\nTest Suite 2: Server-Side Identity & Security Enforcement");
const actionsContent = fs.readFileSync(path.resolve("app/student/elogbook/actions.ts"), "utf-8");

assert(actionsContent.includes('"use server"'), "Actions file declared with 'use server'");
assert(actionsContent.includes('requireRole("student")'), "Enforces server-side student role verification");
assert(actionsContent.includes("createClient()"), "Uses authenticated server Supabase client");
assert(actionsContent.includes("fetchStudentCaseLogsAction"), "Implements fetchStudentCaseLogsAction");
assert(actionsContent.includes("fetchCaseLogByIdAction"), "Implements fetchCaseLogByIdAction");
assert(actionsContent.includes("createCaseLogAction"), "Implements createCaseLogAction");
assert(actionsContent.includes("updateCaseLogAction"), "Implements updateCaseLogAction");
assert(actionsContent.includes("deleteDraftCaseLogAction"), "Implements deleteDraftCaseLogAction");
assert(actionsContent.includes("student_id: user.id"), "Strictly derives student_id from session user.id");
assert(actionsContent.includes("institution_id: profile.institution_id"), "Strictly derives institution_id from session profile");
assert(actionsContent.includes("42P01") || actionsContent.includes("isTableMissing"), "Handles table-missing database error gracefully");

// 3. UI Component Integration & Mock-Store Decoupling
console.log("\nTest Suite 3: Client Components & Supabase Persistence Integration");
const listContent = fs.readFileSync(path.resolve("components/elogbook/case-list.tsx"), "utf-8");
assert(listContent.includes("fetchStudentCaseLogsAction"), "CaseList uses fetchStudentCaseLogsAction");
assert(listContent.includes("deleteDraftCaseLogAction"), "CaseList uses deleteDraftCaseLogAction");
assert(listContent.includes("isTableMissing"), "CaseList renders prerequisite warning if tables are missing");

const formContent = fs.readFileSync(path.resolve("components/elogbook/case-form.tsx"), "utf-8");
assert(formContent.includes("createCaseLogAction"), "CaseForm uses createCaseLogAction");
assert(formContent.includes("updateCaseLogAction"), "CaseForm uses updateCaseLogAction");
assert(
  formContent.includes("setIsTerminologyModalOpen") && formContent.includes("sampleCatalog"),
  "CaseForm has integrated Terminology search modal and catalog"
);

const detailContent = fs.readFileSync(path.resolve("components/elogbook/case-detail.tsx"), "utf-8");
assert(detailContent.includes("deleteDraftCaseLogAction"), "CaseDetail uses deleteDraftCaseLogAction");

// 4. Sidebar Terminology Link Removal Verification
console.log("\nTest Suite 4: Sidebar Clean-up & Terminology Integration Compliance");
const sidebarContent = fs.readFileSync(path.resolve("components/layout/sidebar.tsx"), "utf-8");
assert(
  !sidebarContent.includes('href: "/student/terminology"') && !sidebarContent.includes('href: "/terminology"'),
  "Standalone Terminology nav link successfully removed from Sidebar"
);
assert(
  sidebarContent.includes("/student/elogbook") && sidebarContent.includes("Clinical e-Logbook"),
  "Clinical e-Logbook sidebar link preserved"
);

// 5. Preservation of Terminology Catalog & Component
console.log("\nTest Suite 5: Terminology Component & Sample Catalog Preservation");
const catalogPath = path.resolve("data/terminology/namaste-sample-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
assert(catalog.length === 20, "Phase 1 sample catalog intact with 20 Ayurveda records");
const termSearchPath = path.resolve("components/elogbook/terminology-search.tsx");
assert(fs.existsSync(termSearchPath), "Reusable TerminologySearch component preserved intact");

console.log("\n===============================================================================");
console.log(`  RESULTS: ${passed}/${total} test checks passed successfully.`);
console.log("===============================================================================\n");

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}

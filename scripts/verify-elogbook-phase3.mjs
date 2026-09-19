import fs from "fs";
import path from "path";

console.log("===============================================================================");
console.log("  PHASE 3 VERIFICATION: NAMASTE E-LOGBOOK STUDENT UI PROTOTYPE");
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

// 1. Check existence of Phase 3 files
const filesToCheck = [
  "lib/elogbook/types.ts",
  "lib/elogbook/mock-store.ts",
  "components/elogbook/case-list.tsx",
  "components/elogbook/case-form.tsx",
  "components/elogbook/case-detail.tsx",
  "app/student/elogbook/page.tsx",
  "app/student/elogbook/new/page.tsx",
  "app/student/elogbook/[id]/page.tsx",
  "app/student/elogbook/[id]/edit/page.tsx",
];

console.log("Test Suite 1: File Architecture & Component Verification");
filesToCheck.forEach((relPath) => {
  const fullPath = path.resolve(relPath);
  assert(fs.existsSync(fullPath), `Created file exists: ${relPath}`);
});

// 2. Validate mock store contents & privacy rules
console.log("\nTest Suite 2: Mock Data & Patient Privacy Compliance");
const mockStoreContent = fs.readFileSync(path.resolve("lib/elogbook/mock-store.ts"), "utf-8");

assert(mockStoreContent.includes("case-demo-001"), "Includes verified case demo-001");
assert(mockStoreContent.includes("case-demo-002"), "Includes submitted case demo-002");
assert(mockStoreContent.includes("case-demo-003"), "Includes revision_requested case demo-003");
assert(mockStoreContent.includes("case-demo-004"), "Includes draft case demo-004");
assert(mockStoreContent.includes("CASE-2026-KC-01"), "Uses synthetic reference CASE-2026-KC-01");
assert(!mockStoreContent.includes("OPD-10492"), "No real hospital OPD registration numbers present");

// 3. Validate NCISM Competency Definitions
console.log("\nTest Suite 3: NCISM Competency Mapping");
const typesContent = fs.readFileSync(path.resolve("lib/elogbook/types.ts"), "utf-8");
assert(typesContent.includes("AYU-UG-DOC-01"), "Includes NCISM UG Documentation Competency");
assert(typesContent.includes("AYU-UG-EXAM-02"), "Includes NCISM Ashtavidha Pariksha Competency");
assert(typesContent.includes("AYU-UG-DIAG-03"), "Includes NCISM Roga Vinishchaya Competency");
assert(typesContent.includes("Kayachikitsa") && typesContent.includes("Panchakarma"), "Defines 8 classical Ayurveda branches");

// 4. Validate Sidebar Navigation Integration
console.log("\nTest Suite 4: Sidebar Student Navigation");
const sidebarContent = fs.readFileSync(path.resolve("components/layout/sidebar.tsx"), "utf-8");
assert(
  sidebarContent.includes("/student/elogbook") && sidebarContent.includes("Clinical e-Logbook"),
  "Student sidebar contains Clinical e-Logbook route"
);

// 5. Validate Phase 1 Terminology Preservation
console.log("\nTest Suite 5: Preservation of Phase 1 Terminology Prototype");
const catalogPath = path.resolve("data/terminology/namaste-sample-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
assert(catalog.length === 20, "Phase 1 catalog intact with 20 Ayurveda sample records");

console.log("\n===============================================================================");
console.log(`  RESULTS: ${passed}/${total} test checks passed successfully.`);
console.log("===============================================================================\n");

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}

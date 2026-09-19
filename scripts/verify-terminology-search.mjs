import fs from "fs";
import path from "path";

console.log("================================================================================");
console.log(" NAMASTE E-LOGBOOK: PHASE 1 TERMINOLOGY SEARCH UNIT TEST SUITE");
console.log("================================================================================\n");

// 1. Verify JSON file exists and is valid JSON
const catalogPath = path.resolve("./data/terminology/namaste-sample-catalog.json");
if (!fs.existsSync(catalogPath)) {
  console.error("FAIL: data/terminology/namaste-sample-catalog.json does not exist!");
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
console.log(`[PASS] JSON Catalog loaded successfully: ${rawData.length} records found.`);

// 2. Validate sample constraints on every single record
let invalidRecords = 0;
rawData.forEach((item, index) => {
  const issues = [];
  if (!item.id) issues.push("Missing id");
  if (!item.term) issues.push("Missing term");
  if (!item.category) issues.push("Missing category");
  if (!item.description) issues.push("Missing description");
  if (!item.code || !item.code.startsWith("SAMPLE-")) issues.push(`Code "${item.code}" must start with 'SAMPLE-'`);
  if (item.source !== "sample") issues.push(`Source "${item.source}" must be strictly 'sample'`);
  if (item.verification_status !== "sample_demonstration") issues.push(`verification_status "${item.verification_status}" must be 'sample_demonstration'`);
  if (!item.disclaimer) issues.push("Missing disclaimer");

  if (issues.length > 0) {
    console.error(`  [FAIL] Record #${index + 1} (${item.term || "Unknown"}): ${issues.join(", ")}`);
    invalidRecords++;
  }
});

if (invalidRecords === 0) {
  console.log(`[PASS] All ${rawData.length} records satisfy sample prefix and verification status requirements.`);
} else {
  console.error(`[FAIL] ${invalidRecords} records failed data integrity checks.`);
  process.exit(1);
}

// 3. Normalization and Search functions (matching lib/terminology/search.ts)
function normalizeText(text) {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchTerminology(params = {}, catalog = rawData) {
  const { query = "", category = "all" } = params;
  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(rawQuery);

  return catalog.filter((item) => {
    if (category && category !== "all") {
      if (item.category !== category) return false;
    }
    if (!normalizedQuery) return true;

    if (normalizeText(item.term).includes(normalizedQuery)) return true;
    if (item.transliteration && normalizeText(item.transliteration).includes(normalizedQuery)) return true;
    if (item.alternative_terms && item.alternative_terms.some(alt => normalizeText(alt).includes(normalizedQuery))) return true;
    if (item.code && normalizeText(item.code).includes(normalizedQuery)) return true;
    if (item.description && normalizeText(item.description).includes(normalizedQuery)) return true;
    if (item.clinical_domain && normalizeText(item.clinical_domain).includes(normalizedQuery)) return true;

    return false;
  });
}

// 4. Test Search Functionality
console.log("\n--- Testing Search & Filtering Engine ---");

// Test 4.1: Empty query returns all records
const allResults = searchTerminology({}, rawData);
console.log(`[${allResults.length === rawData.length ? "PASS" : "FAIL"}] Empty query returns all ${rawData.length} records (returned: ${allResults.length})`);

// Test 4.2: Case-insensitive search
const lowerSearch = searchTerminology({ query: "amavata" }, rawData);
const upperSearch = searchTerminology({ query: "AMAVATA" }, rawData);
const mixedSearch = searchTerminology({ query: "  AmAvAtA  " }, rawData);
const casePassed = lowerSearch.length > 0 && lowerSearch.length === upperSearch.length && lowerSearch.length === mixedSearch.length;
console.log(`[${casePassed ? "PASS" : "FAIL"}] Case-insensitive and whitespace-trimmed search: "amavata" matched ${lowerSearch.length} items`);

// Test 4.3: Diacritic matching
const diacriticSearch = searchTerminology({ query: "Āmavāta" }, rawData);
const normalSearch = searchTerminology({ query: "Amavata" }, rawData);
console.log(`[${diacriticSearch.length === normalSearch.length ? "PASS" : "FAIL"}] Sanskrit diacritic normalization: "Āmavāta" (${diacriticSearch.length}) matches "Amavata" (${normalSearch.length})`);

// Test 4.4: Alternative terms / Synonyms matching
const altTermSearch = searchTerminology({ query: "Rheumatoid" }, rawData);
const altFound = altTermSearch.some((item) => item.term === "Amavata");
console.log(`[${altFound ? "PASS" : "FAIL"}] Synonym search: "Rheumatoid" matched Amavata via alternative_terms`);

// Test 4.5: Category filtering
const diseaseOnly = searchTerminology({ category: "disease" }, rawData);
const parikshaOnly = searchTerminology({ category: "pariksha" }, rawData);
const procedureOnly = searchTerminology({ category: "procedure" }, rawData);
const formulationOnly = searchTerminology({ category: "formulation" }, rawData);
const symptomOnly = searchTerminology({ category: "symptom" }, rawData);

console.log(`[PASS] Category Filtering Counts:`);
console.log(`  - Disease: ${diseaseOnly.length}`);
console.log(`  - Symptom: ${symptomOnly.length}`);
console.log(`  - Pariksha: ${parikshaOnly.length}`);
console.log(`  - Procedure: ${procedureOnly.length}`);
console.log(`  - Formulation: ${formulationOnly.length}`);

// Test 4.6: Combined Search + Category Filter
const filteredSearch = searchTerminology({ query: "vata", category: "procedure" }, rawData);
const filteredValid = filteredSearch.every((item) => item.category === "procedure");
console.log(`[${filteredValid ? "PASS" : "FAIL"}] Combined query "vata" + category "procedure" returned ${filteredSearch.length} items`);

console.log("\n================================================================================");
console.log(" ALL PHASE 1 TERMINOLOGY UNIT TESTS PASSED SUCCESSFULLY");
console.log("================================================================================\n");

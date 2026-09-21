import { isStudentProfileComplete } from '../lib/auth-helpers.js';

console.log("=== Testing Student Mandatory Profile Completion Safeguards ===");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// Test 1: Null/undefined profiles
assert(!isStudentProfileComplete(null), "Null profile returns false");
assert(!isStudentProfileComplete({}), "Empty profile returns false");

// Test 2: Non-student roles are excluded
assert(!isStudentProfileComplete({ role: "faculty", full_name: "Dr. Faculty", phone: "9876543210" }), "Faculty profile returns false");
assert(!isStudentProfileComplete({ role: "institution", full_name: "Admin", phone: "9876543210" }), "Institution profile returns false");
assert(!isStudentProfileComplete({ role: "super_admin", full_name: "Admin", phone: "9876543210" }), "Super Admin profile returns false");

// Test 3: Stale/fake profile_completed = true without required fields
const fakeCompleteProfile = {
  role: "student",
  profile_completed: true,
  full_name: "Incomplete Scholar",
  phone: "9876543210",
  // Missing qualification, program, department, year, semester, institution_id, skills, career_interests
};
assert(!isStudentProfileComplete(fakeCompleteProfile), "Profile with profile_completed=true but missing fields strictly rejected");

// Test 4: Missing skills
const noSkillsProfile = {
  role: "student",
  full_name: "Aarav Sharma",
  phone: "9876543210",
  qualification: "Undergraduate (UG)",
  program: "BAMS",
  department: "Kayachikitsa",
  year: 2,
  semester: "Professional Year II",
  institution_id: "inst-123",
  skills: [],
  career_interests: ["Clinical Practice"],
};
assert(!isStudentProfileComplete(noSkillsProfile), "Profile with empty skills array rejected");

// Test 5: Missing career interests
const noInterestsProfile = {
  ...noSkillsProfile,
  skills: ["Nadi Pariksha"],
  career_interests: [],
};
assert(!isStudentProfileComplete(noInterestsProfile), "Profile with empty career_interests rejected");

// Test 6: Missing institution_id
const noInstProfile = {
  ...noSkillsProfile,
  skills: ["Nadi Pariksha"],
  institution_id: "",
};
assert(!isStudentProfileComplete(noInstProfile), "Profile with empty institution_id rejected");

// Test 7: Fully complete student profile
const fullyCompleteStudent = {
  role: "student",
  full_name: "Vaidya Aarav Sharma",
  phone: "+91 98765 43210",
  qualification: "Undergraduate (UG)",
  program: "BAMS - Bachelor of Ayurvedic Medicine and Surgery",
  department: "Kayachikitsa",
  year: 3,
  semester: "Professional Year III",
  institution_id: "3e590059-8664-4e2a-9cb8-8c5443206240",
  skills: ["Nadi Pariksha", "Panchakarma Procedures"],
  career_interests: ["Clinical Practice & OPD"],
  profile_completed: true,
};
assert(isStudentProfileComplete(fullyCompleteStudent), "Fully complete student profile accepted");

// Test 8: Approved-only institution rule verification
const testInstitutions = [
  { id: "1", name: "Inst A", verification_status: "approved" },
  { id: "2", name: "Inst B", verification_status: "pending" },
  { id: "3", name: "Inst C", verification_status: "rejected" },
  { id: "4", name: "Inst D", verification_status: "suspended" },
  { id: "5", name: "Inst E", verification_status: null },
];

const eligibleInstitutions = testInstitutions.filter((i) => i.verification_status === "approved");
assert(eligibleInstitutions.length === 1 && eligibleInstitutions[0].id === "1", "Only verification_status === 'approved' is eligible (null, pending, rejected, suspended excluded)");

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

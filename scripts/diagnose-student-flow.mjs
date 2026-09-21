import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminSb = serviceKey ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey) : null;

async function diagnose() {
  console.log("=== DIAGNOSTIC: Student Profile Completion Flow ===\n");

  // 1. Check if the new columns actually exist in the database
  console.log("--- TEST 1: Do the new profile columns exist in the database? ---");
  
  // Try querying with explicit new column names (like the proxy does)
  const { data: explicitData, error: explicitError } = await sb
    .from("profiles")
    .select("role, full_name, phone, qualification, program, department, year, semester, institution_id, skills, career_interests, profile_completed")
    .limit(1);
  
  if (explicitError) {
    console.log("[CRITICAL] Proxy-style query FAILS:", explicitError.message);
    console.log("[CRITICAL] This means the migration was NOT applied. The proxy query");
    console.log("           breaks every time, returning null profile, which derails all routing.\n");
  } else {
    console.log("[OK] Proxy-style query succeeds. Columns exist.");
    console.log("     Sample row:", JSON.stringify(explicitData?.[0], null, 2), "\n");
  }
  
  // 2. Check what select("*") returns
  console.log("--- TEST 2: What does select('*') return for profiles? ---");
  const { data: starData, error: starError } = await sb
    .from("profiles")
    .select("*")
    .limit(1);

  if (starError) {
    console.log("[ERROR] select('*') also fails:", starError.message, "\n");
  } else if (starData && starData.length > 0) {
    const cols = Object.keys(starData[0]);
    console.log("[OK] Columns returned by select('*'):", cols);
    console.log("     Has 'qualification':", cols.includes('qualification'));
    console.log("     Has 'semester':", cols.includes('semester'));
    console.log("     Has 'skills':", cols.includes('skills'));
    console.log("     Has 'career_interests':", cols.includes('career_interests'));
    console.log("     Has 'profile_completed':", cols.includes('profile_completed'));
    console.log("");
  } else {
    console.log("[INFO] No profiles in the database.\n");
  }

  // 3. Check student profiles specifically
  console.log("--- TEST 3: Student profiles in the database ---");
  const { data: students, error: studErr } = await sb
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .limit(5);

  if (studErr) {
    console.log("[ERROR] Failed to query student profiles:", studErr.message, "\n");
  } else if (students && students.length > 0) {
    console.log(`[OK] Found ${students.length} student profile(s).`);
    for (const s of students) {
      console.log(`\n  Student: ${s.full_name || '(no name)'} (id: ${s.id})`);
      console.log(`    role: ${s.role}`);
      console.log(`    full_name: '${s.full_name}'`);
      console.log(`    phone: '${s.phone}'`);
      console.log(`    qualification: '${s.qualification}'`);
      console.log(`    program: '${s.program}'`);
      console.log(`    department: '${s.department}'`);
      console.log(`    year: ${s.year}`);
      console.log(`    semester: '${s.semester}'`);
      console.log(`    institution_id: '${s.institution_id}'`);
      console.log(`    skills: ${JSON.stringify(s.skills)}`);
      console.log(`    career_interests: ${JSON.stringify(s.career_interests)}`);
      console.log(`    profile_completed: ${s.profile_completed}`);
    }
    console.log("");
  } else {
    console.log("[INFO] No student profiles found.\n");
  }

  // 4. Check approved institutions
  console.log("--- TEST 4: Approved institutions ---");
  const { data: insts, error: instErr } = await sb
    .from("institutions")
    .select("id, name, code, verification_status")
    .eq("verification_status", "approved")
    .limit(10);
    
  if (instErr) {
    console.log("[ERROR] Institution query failed:", instErr.message, "\n");
  } else {
    console.log(`[OK] Found ${(insts || []).length} approved institution(s).`);
    (insts || []).forEach(i => console.log(`  - ${i.name} (${i.code || 'no code'}) [${i.verification_status}]`));
    console.log("");
  }

  // 5. Simulate isStudentProfileComplete on live data
  console.log("--- TEST 5: Simulate isStudentProfileComplete on live student data ---");
  if (students && students.length > 0) {
    for (const s of students) {
      const hasPersonal = Boolean(s.full_name?.trim()) && Boolean(s.phone?.trim());
      const hasAcademic =
        Boolean(s.qualification?.trim()) &&
        Boolean(s.program?.trim()) &&
        Boolean(s.department?.trim()) &&
        s.year !== null && s.year !== undefined && Number(s.year) > 0 &&
        Boolean(s.semester?.trim());
      const hasInstitution = Boolean(s.institution_id?.trim());
      const hasSkills = Array.isArray(s.skills) && s.skills.length > 0;
      const hasInterests = Array.isArray(s.career_interests) && s.career_interests.length > 0;
      const isComplete = hasPersonal && hasAcademic && hasInstitution && hasSkills && hasInterests;
      
      console.log(`\n  ${s.full_name || '(unnamed)'}: isStudentProfileComplete = ${isComplete}`);
      console.log(`    hasPersonal: ${hasPersonal} (name: ${Boolean(s.full_name?.trim())}, phone: ${Boolean(s.phone?.trim())})`);
      console.log(`    hasAcademic: ${hasAcademic} (qual: ${Boolean(s.qualification?.trim())}, prog: ${Boolean(s.program?.trim())}, dept: ${Boolean(s.department?.trim())}, year: ${s.year !== null && Number(s.year) > 0}, sem: ${Boolean(s.semester?.trim())})`);
      console.log(`    hasInstitution: ${hasInstitution}`);
      console.log(`    hasSkills: ${hasSkills}`);
      console.log(`    hasInterests: ${hasInterests}`);
    }
  }
  
  console.log("\n=== DIAGNOSIS COMPLETE ===");
}

diagnose().catch(err => {
  console.error("Diagnostic script error:", err);
  process.exit(1);
});

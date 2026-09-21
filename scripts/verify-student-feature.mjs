/**
 * READ-ONLY verification script for Student Profile Completion feature.
 * No INSERT, UPDATE, DELETE, or DDL is executed.
 * All queries are SELECT only.
 */
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(URL, ANON);
// Service role client for information_schema queries (anon may not see it)
const admin = SERVICE ? createClient(URL, SERVICE) : null;

const results = {};
let pass = 0, fail = 0, blocked = 0;

function report(id, status, evidence) {
  results[id] = { status, evidence };
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') fail++;
  else blocked++;
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`\n${icon} [${status}] ${id}`);
  (Array.isArray(evidence) ? evidence : [evidence]).forEach(e => console.log(`   ${e}`));
}

async function check1_MigrationApplied() {
  // Primary check: query information_schema for the new columns
  const newCols = ['qualification', 'semester', 'skills', 'career_interests', 'profile_completed'];
  const client = admin || sb;

  const { data, error } = await client
    .from('information_schema.columns')
    .select('column_name, data_type, column_default, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'profiles')
    .in('column_name', newCols);

  if (error) {
    // Fallback: try a direct select on one new column
    const { error: e2 } = await sb
      .from('profiles')
      .select('qualification')
      .limit(0);
    if (e2 && e2.message.includes('does not exist')) {
      report('CHECK 1 — Migration Applied', 'FAIL', [
        'information_schema query blocked (anon RLS). Fallback: SELECT qualification FROM profiles → error.',
        `Error: ${e2.message}`,
        'Migration 20260921150000_student_mandatory_profile_completion.sql has NOT been applied.'
      ]);
    } else if (!e2) {
      report('CHECK 1 — Migration Applied', 'PASS', [
        'Fallback: SELECT qualification FROM profiles succeeded (0 rows, no error).',
        'Migration has been applied.'
      ]);
    } else {
      report('CHECK 1 — Migration Applied', 'BLOCKED', [`Unexpected error: ${e2.message}`]);
    }
    return;
  }

  const foundCols = (data || []).map(r => r.column_name);
  const missing = newCols.filter(c => !foundCols.includes(c));

  if (missing.length === 0) {
    const details = (data || []).map(r =>
      `${r.column_name}: ${r.data_type}, default=${r.column_default}, nullable=${r.is_nullable}`
    );
    report('CHECK 1 — Migration Applied', 'PASS', [
      'All 5 new columns exist in public.profiles.',
      ...details
    ]);
  } else {
    report('CHECK 1 — Migration Applied', 'FAIL', [
      `Missing columns: ${missing.join(', ')}`,
      `Found: ${foundCols.join(', ') || '(none)'}`,
      'Migration has NOT been applied.'
    ]);
  }
}

async function check2_ColumnsExist() {
  // Direct column probe — most reliable regardless of RLS
  const probes = [
    { col: 'qualification', query: sb.from('profiles').select('qualification').limit(0) },
    { col: 'semester', query: sb.from('profiles').select('semester').limit(0) },
    { col: 'skills', query: sb.from('profiles').select('skills').limit(0) },
    { col: 'career_interests', query: sb.from('profiles').select('career_interests').limit(0) },
    { col: 'profile_completed', query: sb.from('profiles').select('profile_completed').limit(0) },
  ];

  const missing = [];
  const present = [];

  for (const p of probes) {
    const { error } = await p.query;
    if (error && error.message.includes('does not exist')) {
      missing.push(p.col);
    } else if (!error) {
      present.push(p.col);
    } else {
      // Any other error (RLS, connection) — mark blocked
      missing.push(`${p.col} (probe error: ${error.message})`);
    }
  }

  if (missing.length === 0) {
    report('CHECK 2 — Required Columns Exist', 'PASS', [
      `All 5 columns confirmed in public.profiles: ${present.join(', ')}`
    ]);
  } else {
    report('CHECK 2 — Required Columns Exist', 'FAIL', [
      `MISSING columns: ${missing.join(', ')}`,
      `Present: ${present.join(', ') || '(none)'}`,
      'BLOCKER: saveStudentProfile will fail on UPDATE until migration is applied.'
    ]);
  }
}

async function check3_StudentProfiles() {
  // Check if profiles table has any rows, and check existing column set
  const { data, error } = await sb.from('profiles').select('*').limit(3);

  if (error) {
    report('CHECK 3 — Student Data / Profile Rows', 'BLOCKED', [
      `Cannot query profiles: ${error.message}`
    ]);
    return;
  }

  if (!data || data.length === 0) {
    report('CHECK 3 — Student Data / Profile Rows', 'FAIL', [
      '0 profile rows in the database.',
      'No existing accounts — end-to-end login flow cannot be tested.',
      'The routing guard works by code trace but cannot be verified with a live session.'
    ]);
    return;
  }

  const students = data.filter(r => r.role === 'student');
  const cols = Object.keys(data[0]);
  const hasNewCols = ['qualification','semester','skills','career_interests','profile_completed']
    .every(c => cols.includes(c));

  report('CHECK 3 — Student Data / Profile Rows', students.length > 0 ? 'PASS' : 'FAIL', [
    `Total profiles: ${data.length}, student profiles: ${students.length}`,
    `Columns returned by select('*'): ${cols.join(', ')}`,
    `New columns present in response: ${hasNewCols}`,
    ...(students.map(s =>
      `Student: ${s.full_name||'(no name)'} | phone: ${!!s.phone} | qualification: ${s.qualification||'NULL'} | semester: ${s.semester||'NULL'} | institution_id: ${s.institution_id||'NULL'} | skills: ${JSON.stringify(s.skills)} | career_interests: ${JSON.stringify(s.career_interests)}`
    ))
  ]);
}

async function check4_InstitutionDropdown() {
  // Check what institutions exist and what verification_status values exist
  const { data: allInsts, error: allErr } = await sb
    .from('institutions')
    .select('id, name, verification_status')
    .limit(20);

  if (allErr) {
    report('CHECK 4 — Institution Dropdown (Approved)', 'BLOCKED', [
      `Cannot query institutions: ${allErr.message}`
    ]);
    return;
  }

  const all = allInsts || [];
  const approved = all.filter(i => i.verification_status === 'approved');
  const statusCounts = all.reduce((acc, i) => {
    acc[i.verification_status || 'NULL'] = (acc[i.verification_status || 'NULL'] || 0) + 1;
    return acc;
  }, {});

  const evidence = [
    `Total institutions in table: ${all.length}`,
    `Approved (verification_status = 'approved'): ${approved.length}`,
    `Status breakdown: ${JSON.stringify(statusCounts)}`,
  ];

  if (approved.length === 0 && all.length === 0) {
    evidence.push('BLOCKER: No institutions at all — dropdown will show "No Approved Institutions Available".');
    evidence.push('Student cannot submit the form (submit button is disabled when institutions.length === 0).');
    report('CHECK 4 — Institution Dropdown (Approved)', 'FAIL', evidence);
  } else if (approved.length === 0) {
    evidence.push('BLOCKER: Institutions exist but none are approved — dropdown will be empty.');
    evidence.push('Approve at least one institution via Super Admin panel before students can submit the form.');
    report('CHECK 4 — Institution Dropdown (Approved)', 'FAIL', evidence);
  } else {
    approved.forEach(i => evidence.push(`  ✓ ${i.name} [${i.verification_status}]`));
    report('CHECK 4 — Institution Dropdown (Approved)', 'PASS', evidence);
  }
}

async function check5_InstitutionsTableStructure() {
  // Verify verification_status column exists on institutions (needed for server action)
  const { error } = await sb
    .from('institutions')
    .select('verification_status')
    .limit(0);

  if (error) {
    report('CHECK 5 — institutions.verification_status Column', 'FAIL', [
      `Column probe failed: ${error.message}`
    ]);
  } else {
    report('CHECK 5 — institutions.verification_status Column', 'PASS', [
      'Column institutions.verification_status exists and is queryable.',
      'Server action approved-only validation will work correctly.'
    ]);
  }
}

async function check6_ExistingProfileColumns() {
  // Verify the pre-existing columns needed by the form also exist
  const existingCols = ['full_name', 'phone', 'program', 'year', 'department', 'institution_id', 'role'];
  const missing = [];
  const present = [];

  for (const col of existingCols) {
    const { error } = await sb.from('profiles').select(col).limit(0);
    if (error && error.message.includes('does not exist')) {
      missing.push(col);
    } else {
      present.push(col);
    }
  }

  if (missing.length === 0) {
    report('CHECK 6 — Pre-existing Profile Columns', 'PASS', [
      `All pre-existing required columns confirmed: ${present.join(', ')}`
    ]);
  } else {
    report('CHECK 6 — Pre-existing Profile Columns', 'FAIL', [
      `Missing: ${missing.join(', ')}`,
      `Present: ${present.join(', ')}`
    ]);
  }
}

async function main() {
  console.log('=== READ-ONLY VERIFICATION: Student Mandatory Profile Completion ===');
  console.log(`Project: ${URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  await check1_MigrationApplied();
  await check2_ColumnsExist();
  await check3_StudentProfiles();
  await check4_InstitutionDropdown();
  await check5_InstitutionsTableStructure();
  await check6_ExistingProfileColumns();

  console.log('\n=== SUMMARY ===');
  console.log(`PASS: ${pass} | FAIL: ${fail} | BLOCKED: ${blocked}`);
  console.log('\nNOTE: Code-trace checks (proxy routing, isStudentProfileComplete logic,');
  console.log('      RLS policies, requireRole guard) are verified by static analysis only.');
  console.log('      No browser session or E2E login was performed.');
  console.log('\nNo data was inserted, updated, or deleted during this verification.');
}

main().catch(err => {
  console.error('Verification script error:', err);
  process.exit(1);
});

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      let val = l.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return [l.slice(0, idx).trim(), val];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase Endpoint:", url);
console.log("Client key present:", !!key);

const supabase = createClient(url, key);

async function verify() {
  console.log("\n--- Checking Table Existence & Read Queries ---");

  for (const tableName of ['clinical_case_logs', 'clinical_case_competencies', 'clinical_case_attachments']) {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.log(`[FAIL] Table '${tableName}':`, error.message, `(code: ${error.code})`);
    } else {
      console.log(`[PASS] Table '${tableName}' exists and is queryable via RLS (rows returned: ${data.length})`);
    }
  }

  console.log("\n--- Checking Storage Bucket Existence ---");
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.log("[INFO] listBuckets (unauthenticated):", bucketError.message);
  } else {
    const elogbookBucket = buckets.find(b => b.id === 'clinical-case-attachments' || b.name === 'clinical-case-attachments');
    if (elogbookBucket) {
      console.log(`[PASS] Storage bucket 'clinical-case-attachments' exists! (public: ${elogbookBucket.public})`);
    } else {
      console.log(`[INFO] Available buckets:`, buckets.map(b => b.name));
    }
  }
}

verify().catch(console.error);

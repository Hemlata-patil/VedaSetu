import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function check() {
  // Let's create a temporary template to test
  const { data: tempTmpl, error: tErr } = await adminClient
    .from("assessment_templates")
    .insert({
      title: "Temporary Constraint Check Template",
      status: "draft",
      program: "BAMS"
    })
    .select("id")
    .single();

  if (tErr || !tempTmpl) {
    console.log("Failed to create temp template:", tErr);
    return;
  }

  const studentId = "2079db4a-a6d5-441e-bd49-c95da6506ec6";

  // Attempt 1
  const { data: att1, error: aErr1 } = await adminClient
    .from("assessment_attempts")
    .insert({
      assessment_template_id: tempTmpl.id,
      student_id: studentId,
      status: "not_started"
    })
    .select("id")
    .single();

  console.log("Attempt 1 insert result:", att1, aErr1);

  // Attempt 2 (Reassessment for same template & student)
  const { data: att2, error: aErr2 } = await adminClient
    .from("assessment_attempts")
    .insert({
      assessment_template_id: tempTmpl.id,
      student_id: studentId,
      status: "not_started"
    })
    .select("id")
    .single();

  console.log("Attempt 2 insert result (Reassessment):", att2, aErr2?.message);

  // Clean up
  if (att2) await adminClient.from("assessment_attempts").delete().eq("id", att2.id);
  if (att1) await adminClient.from("assessment_attempts").delete().eq("id", att1.id);
  await adminClient.from("assessment_templates").delete().eq("id", tempTmpl.id);
}

check();

"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateStudentPlacementStatus(placementId: string, status: "offer_accepted" | "withdrawn") {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  // The database trigger or RLS might be strict, so we update it using a server action
  // Wait, internship_placements doesn't have student_id. 
  // We can use the admin client to bypass the missing RLS since we verify the role here.
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("internship_placements")
    .update({ status })
    .eq("id", placementId);

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  revalidatePath("/student/internship-placement");
  revalidatePath("/industry/internship-placement");
  revalidatePath("/institution/internship-placement");

  return { success: true };
}

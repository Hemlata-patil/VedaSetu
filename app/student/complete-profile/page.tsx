import { requireRole, isStudentProfileComplete } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { CompleteProfileForm } from "./complete-profile-form";

export const metadata = {
  title: "Complete Student Profile — VEDA SETU",
  description: "Mandatory student academic coordinate and profile registration",
};

async function CompleteProfileContent() {
  // 1. Authoritative student authentication allowing incomplete state
  const { user, profile, supabase } = await requireRole("student", { allowIncomplete: true });

  // 2. If profile is already complete, redirect directly to student dashboard
  if (isStudentProfileComplete(profile)) {
    redirect("/student/dashboard");
  }

  // 3. Dynamically query only verified approved institutions from public.institutions
  const { data: institutions } = await supabase
    .from("institutions")
    .select("id, name, code, category, location, verification_status")
    .eq("verification_status", "approved")
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-ayush-parchment/60 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Image
              src="/images/veda-setu-logo.png"
              alt="Veda Setu"
              width={180}
              height={60}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ayush-dark">
            Complete Your Student Profile
          </h1>
          <p className="text-xs sm:text-sm text-ayush-muted max-w-xl mx-auto">
            Welcome to VEDA SETU. Before accessing your Student Dashboard, clinical logbooks, and academic assessments, please complete your verified academic coordinates.
          </p>
        </div>

        {/* Dynamic Form Component */}
        <CompleteProfileForm
          profile={profile}
          userEmail={user.email || ""}
          institutions={institutions || []}
        />
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-lg text-ayush-dark">
            Loading Registration Portal...
          </div>
        </div>
      }
    >
      <CompleteProfileContent />
    </Suspense>
  );
}

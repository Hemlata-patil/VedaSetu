import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function RoleDispatcher() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Authoritative role lookup from the database profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.role) {
    redirect("/profile");
  }

  switch (profile.role) {
    case "super_admin":
      redirect("/super-admin/dashboard");
    case "faculty":
      redirect("/faculty/dashboard");
    case "institution":
      redirect("/institution/dashboard");
    case "industry":
      redirect("/industry/dashboard");
    case "student":
      redirect("/student/dashboard");
    default:
      redirect("/profile");
  }

  return null;
}

export default function DashboardDispatcherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ayush-parchment">
          <div className="animate-pulse font-heading text-xl text-ayush-dark">
            Loading Ayush Portal...
          </div>
        </div>
      }
    >
      <RoleDispatcher />
    </Suspense>
  );
}

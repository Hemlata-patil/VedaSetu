import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore if session already closed
  }

  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/auth/login", url.origin), {
    status: 302,
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore if session already closed
  }

  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/auth/login", url.origin), {
    status: 302,
  });
}

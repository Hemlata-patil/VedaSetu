import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isProtectedRoute =
    pathname.startsWith("/student") ||
    pathname.startsWith("/faculty") ||
    pathname.startsWith("/institution") ||
    pathname.startsWith("/industry") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/protected");

  function getRoleDashboardPath(role: string): string {
    if (role === "super_admin") {
      return "/super-admin/dashboard";
    }
    return `/${role}/dashboard`;
  }

  // Redirect unauthenticated users from protected dashboard routes to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Authoritative role routing and cross-role protection for authenticated users
  if (user && isProtectedRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.role) {
      if (pathname !== "/profile") {
        const url = request.nextUrl.clone();
        url.pathname = "/profile";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    const userRole = profile.role;

    if (pathname === "/dashboard") {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(userRole);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/student") && userRole !== "student") {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(userRole);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/faculty") && userRole !== "faculty") {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(userRole);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/institution") && userRole !== "institution") {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(userRole);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/industry") && userRole !== "industry") {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(userRole);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/super-admin") && userRole !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(userRole);
      return NextResponse.redirect(url);
    }
  }

  // Redirect logged-in users away from auth pages to their dashboard
  if (user && (pathname === "/auth/login" || pathname === "/auth/sign-up")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.role) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile";
      return NextResponse.redirect(url);
    }

    const userRole = profile.role;
    const url = request.nextUrl.clone();
    url.pathname = getRoleDashboardPath(userRole);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

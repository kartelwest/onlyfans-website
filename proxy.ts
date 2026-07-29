import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE,
  isExpired,
} from "@/lib/auth/inactivityConfig";

function redirectWithCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);

  for (const cookie of sourceResponse.cookies.getAll()) {
    const { name, value, ...options } = cookie;
    redirectResponse.cookies.set(name, value, options as Parameters<typeof redirectResponse.cookies.set>[2]);
  }

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Coarse gating for authenticated routes (defense in depth)
  const { pathname } = request.nextUrl;
  const protectedRoutes = [
    "/owner",
    "/admin",
    "/administrator",
    "/representative",
    "/area-da-modelo",
    "/alterar-senha",
    "/api/brand",
  ];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnTo", pathname);
      return redirectWithCookies(loginUrl, response);
    }

    const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE);
    const lastActivity = lastActivityCookie ? Number(lastActivityCookie.value) : null;

    if (isExpired(lastActivity)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("expired", "1");
      loginUrl.searchParams.set("returnTo", pathname);

      const expiredResponse = redirectWithCookies(loginUrl, response);

      expiredResponse.cookies.delete(LAST_ACTIVITY_COOKIE);

      return expiredResponse;
    }

    const now = Date.now();
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.ceil(INACTIVITY_TIMEOUT_MS / 1000),
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
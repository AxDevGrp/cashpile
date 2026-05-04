import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const APP_ROUTES = ["/cashboard", "/books", "/trades", "/pulse", "/ai", "/settings"];
const AGENT_RATE_LIMIT = { requests: 120, windowMs: 60_000 };
const agentRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and auth callback
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/auth/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/agent/")) {
      const key =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";
      const now = Date.now();
      const current = agentRateLimit.get(key);
      if (!current || current.resetAt <= now) {
        agentRateLimit.set(key, { count: 1, resetAt: now + AGENT_RATE_LIMIT.windowMs });
      } else {
        current.count++;
        if (current.count > AGENT_RATE_LIMIT.requests) {
          return NextResponse.json(
            { error: "Rate limit exceeded" },
            {
              status: 429,
              headers: {
                "Retry-After": String(Math.ceil((current.resetAt - now) / 1000)),
              },
            }
          );
        }
      }
    }
    // TODO: wire up Redis-based rate limiting in production
    return NextResponse.next();
  }

  // Only guard app routes
  const isAppRoute = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (!isAppRoute) return NextResponse.next();

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

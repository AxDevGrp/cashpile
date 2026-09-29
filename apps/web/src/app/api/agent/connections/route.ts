import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { getConsumerExperience } from "@/lib/consumer-experience";
import { ConnectionError, createConnection, listConnections } from "@/modules/agent/connections";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function errorResponse(err: unknown): NextResponse {
  if (err instanceof ConnectionError) {
    return NextResponse.json({ error: { code: err.code } }, { status: err.status, headers: NO_STORE });
  }
  return NextResponse.json({ error: { code: "unavailable" } }, { status: 503, headers: NO_STORE });
}

function checkSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>([new URL(req.url).origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      /* ignore malformed config */
    }
  }
  return allowed.has(origin);
}

async function sessionClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase: supabase as any, userId: user?.id ?? null };
}

export async function GET() {
  const { supabase, userId } = await sessionClient();
  if (!userId) return errorResponse(new ConnectionError("unauthenticated", 401));
  try {
    const connections = await listConnections(supabase);
    return NextResponse.json({ connections }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  if (!checkSameOrigin(req)) return errorResponse(new ConnectionError("forbidden", 403));

  const { supabase, userId } = await sessionClient();
  if (!userId) return errorResponse(new ConnectionError("unauthenticated", 401));

  // New scope issuance is for eligible consumer users only.
  const experience = await getConsumerExperience();
  if (!experience.enabled) return errorResponse(new ConnectionError("forbidden", 403));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new ConnectionError("invalid_input", 400));
  }

  const name = body && typeof body === "object" ? (body as any).name : undefined;
  try {
    const created = await createConnection(supabase, name);
    // Plaintext token is returned exactly once and never logged or persisted.
    return NextResponse.json(created, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { ConnectionError, revokeConnection } from "@/modules/agent/connections";

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkSameOrigin(req)) return errorResponse(new ConnectionError("forbidden", 403));

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse(new ConnectionError("unauthenticated", 401));

  try {
    await revokeConnection(supabase as any, params.id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

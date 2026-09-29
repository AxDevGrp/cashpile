import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import {
  MAX_BODY_BYTES,
  ReviewError,
  listConsumerReview,
  saveConsumerReview,
} from "@/modules/books/services/consumer-review";
import { revalidateConsumerPaths } from "@/lib/revalidate-consumer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function errorResponse(err: unknown): NextResponse {
  if (err instanceof ReviewError) {
    return NextResponse.json({ error: { code: err.code } }, { status: err.status, headers: NO_STORE });
  }
  // Never leak raw SQL or user financial payloads.
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

async function sessionUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase: supabase as any, userId: user?.id ?? null };
}

export async function GET(req: NextRequest) {
  const { supabase, userId } = await sessionUser();
  if (!userId) return errorResponse(new ReviewError("unauthenticated", 401));

  const params = req.nextUrl.searchParams;
  const limitRaw = params.get("limit");
  try {
    const page = await listConsumerReview(supabase, userId, {
      accountId: params.get("accountId"),
      limit: limitRaw == null ? undefined : Number(limitRaw),
      cursor: params.get("cursor"),
    });
    return NextResponse.json(page, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  if (!checkSameOrigin(req)) return errorResponse(new ReviewError("forbidden", 403));

  const { supabase, userId } = await sessionUser();
  if (!userId) return errorResponse(new ReviewError("unauthenticated", 401));

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return errorResponse(new ReviewError("invalid_input", 400));
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(new ReviewError("invalid_input", 400));
  }

  try {
    const result = await saveConsumerReview(supabase, userId, body);
    revalidateConsumerPaths();
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

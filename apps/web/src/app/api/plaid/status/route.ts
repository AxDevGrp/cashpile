import { NextResponse } from "next/server";
import { getPlaidConfigStatus } from "@/lib/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPlaidConfigStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

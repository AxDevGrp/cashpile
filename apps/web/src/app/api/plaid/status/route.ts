import { NextResponse } from "next/server";
import { getPlaidConfigStatus } from "@/lib/plaid";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getPlaidConfigStatus());
}

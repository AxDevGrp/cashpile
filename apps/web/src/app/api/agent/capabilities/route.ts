import { NextResponse } from "next/server";
import { AGENT_CAPABILITIES } from "@/modules/agent/capabilities";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    name: "Cashpile Agent Capability Registry",
    version: "2026-05-02",
    capabilities: AGENT_CAPABILITIES,
  });
}

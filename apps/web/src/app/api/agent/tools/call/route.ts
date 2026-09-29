import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/modules/agent/auth";
import { callAgentCapability } from "@/modules/agent/executor";
import { httpStatusForErrorCode } from "@/modules/agent/consumer-agent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const principal = await authenticateAgentRequest(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; input?: Record<string, unknown>; confirmationToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const result = await callAgentCapability({
    principal,
    name: body.name,
    input: body.input as Record<string, any> | undefined,
    confirmationToken: body.confirmationToken,
    requestId: req.headers.get("x-request-id"),
  });

  // Deterministic error codes win; legacy results keep the original mapping.
  const status = result.ok
    ? 200
    : result.requiresConfirmation
      ? 409
      : result.errorCode
        ? httpStatusForErrorCode(result.errorCode)
        : 400;

  const headers =
    result.errorCode === "rate_limited" && result.retryAfterSeconds
      ? { "Retry-After": String(result.retryAfterSeconds) }
      : undefined;

  return NextResponse.json(result, { status, headers });
}

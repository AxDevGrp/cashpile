import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServerSupabaseClient } from "@cashpile/db";
import { handleWebhookResult } from "@/modules/pulse/services/prediction.service";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.MIROFISH_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-mirofish-signature") ?? "";

  // HMAC-SHA256 verification
  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  const isValid =
    sigBuffer.length === expectedBuffer.length &&
    timingSafeEqual(sigBuffer, expectedBuffer);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { job_id?: string; report?: unknown; status?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, report, status } = payload;

  if (!job_id) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  if (status === "failed") {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("pulse_predictions")
      .update({ status: "failed", error_message: "Simulation failed" })
      .eq("mirofish_job_id", job_id);
    return NextResponse.json({ ok: true });
  }

  if (status === "complete" && report) {
    const supabase = await createServerSupabaseClient();
    try {
      await handleWebhookResult(supabase, job_id, report);
    } catch (err) {
      console.error("handleWebhookResult error:", err);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

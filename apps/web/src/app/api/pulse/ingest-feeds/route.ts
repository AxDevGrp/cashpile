import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { ingestAllFeeds } from "@/modules/pulse/services/feed.service";
import { triggerPrediction } from "@/modules/pulse/services/prediction.service";

export const maxDuration = 60; // seconds (Vercel/Railway Pro)

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const result = await ingestAllFeeds(supabase);

  // Auto-trigger MiroFish predictions for high/critical new events
  if (result.ingested > 0 && process.env.MIROFISH_URL) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    // Fetch the most recently ingested high/critical events
    const { data: hotEvents } = await supabase
      .from("pulse_events")
      .select("id, severity")
      .in("severity", ["high", "critical"])
      .order("ingested_at", { ascending: false })
      .limit(result.ingested);

    let triggered = 0;
    for (const event of hotEvents ?? []) {
      try {
        await triggerPrediction(supabase, event.id, baseUrl);
        triggered++;
      } catch (err) {
        console.error("Failed to trigger prediction for event", event.id, err);
      }
    }
    result.triggered_predictions = triggered;
  }

  return NextResponse.json(result);
}

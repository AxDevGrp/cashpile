"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { ingestAllFeeds } from "@/modules/pulse/services/feed.service";
import { ingestXFeeds } from "@/modules/pulse/services/x-feed.service";
import { triggerPrediction } from "@/modules/pulse/services/prediction.service";

export async function ingestFeeds() {
  const supabase = await createServerSupabaseClient();

  // Ingest RSS feeds
  const rssResult = await ingestAllFeeds(supabase);

  // Ingest X/Twitter if configured
  let xResult = { ingested: 0, skipped: 0, errors: 0, triggered_predictions: 0 };
  if (process.env.X_BEARER_TOKEN) {
    try {
      xResult = await ingestXFeeds(supabase, {
        xBearerToken: process.env.X_BEARER_TOKEN,
        grokApiKey: process.env.XAI_API_KEY,
      });
    } catch (err) {
      console.error("X feed ingestion failed:", err);
      xResult.errors++;
    }
  }

  const totalIngested = rssResult.ingested + xResult.ingested;

  // Auto-trigger predictions for high/critical events
  let triggered = 0;
  if (totalIngested > 0) {
    const { data: hotEvents } = await supabase
      .from("pulse_events")
      .select("id, severity")
      .in("severity", ["high", "critical"])
      .order("ingested_at", { ascending: false })
      .limit(totalIngested);

    for (const event of hotEvents ?? []) {
      try {
        await triggerPrediction(supabase, event.id);
        triggered++;
      } catch (err) {
        console.error("Failed to trigger prediction for event", event.id, err);
      }
    }
  }

  return {
    rss: rssResult,
    x: xResult,
    total_ingested: totalIngested,
    triggered_predictions: triggered,
  };
}

/**
 * Prediction Service — manages MiroFish job lifecycle and correlation data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatEventAsMiroFishSeed,
  submitJob,
  parseImpactReport,
  generateAlertMessage,
} from "@cashpile/ai/pulse";
import type { EventWithPrediction, CorrelationCell, EventCategory } from "../types";
import type { InstrumentImpact } from "@cashpile/ai/pulse";

export async function triggerPrediction(
  supabase: SupabaseClient,
  eventId: string,
  callbackBaseUrl: string
): Promise<string> {
  // Fetch event
  const { data: event, error } = await supabase
    .from("pulse_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (error) throw new Error(error.message);

  // Format seed
  const seed = formatEventAsMiroFishSeed({
    id: event.id,
    title: event.title,
    summary: event.summary ?? "",
    category: event.category,
    severity: event.severity,
    affected_instruments: (event.affected_instruments as string[]) ?? [],
    published_at: event.published_at,
    source: event.source,
  });

  const callbackUrl = `${callbackBaseUrl}/api/pulse/mirofish-webhook`;

  // Submit to MiroFish
  const { job_id } = await submitJob(seed, callbackUrl);

  // Insert pending prediction row
  const { data: pred, error: predErr } = await supabase
    .from("pulse_predictions")
    .insert({
      event_id: eventId,
      mirofish_job_id: job_id,
      status: "pending",
    })
    .select("id")
    .single();
  if (predErr) throw new Error(predErr.message);

  return pred.id;
}

export async function handleWebhookResult(
  supabase: SupabaseClient,
  jobId: string,
  rawReport: unknown
): Promise<void> {
  // Find prediction row
  const { data: pred, error } = await supabase
    .from("pulse_predictions")
    .select("id, event_id")
    .eq("mirofish_job_id", jobId)
    .maybeSingle();
  if (error || !pred) throw new Error(`Prediction not found for job ${jobId}`);

  const report = parseImpactReport(rawReport);
  const impactsMap: Record<string, InstrumentImpact> = {};
  for (const impact of report.instrument_impacts) {
    impactsMap[impact.instrument] = impact;
  }

  const now = new Date().toISOString();

  // Update prediction to complete
  await supabase
    .from("pulse_predictions")
    .update({
      status: "complete",
      report_json: report as unknown as Record<string, unknown>,
      instrument_impacts: impactsMap as unknown as Record<string, unknown>,
      completed_at: now,
    })
    .eq("id", pred.id);

  // Get event title for alert messages
  const { data: event } = await supabase
    .from("pulse_events")
    .select("title, affected_instruments")
    .eq("id", pred.event_id)
    .single();

  if (!event) return;

  // Generate alerts for all watchlisted users watching affected instruments
  const affectedInstruments = (event.affected_instruments as string[]) ?? [];
  if (affectedInstruments.length === 0) return;

  const { data: watchlistItems } = await supabase
    .from("pulse_watchlist")
    .select("user_id, instrument")
    .in("instrument", affectedInstruments)
    .eq("is_active", true);

  if (!watchlistItems?.length) return;

  const alerts = watchlistItems
    .map((w) => {
      const impact = impactsMap[w.instrument];
      if (!impact) return null;
      const message = generateAlertMessage(
        event.title,
        w.instrument,
        impact.direction,
        impact.magnitude_pct,
        impact.confidence
      );
      return {
        user_id: w.user_id,
        event_id: pred.event_id,
        prediction_id: pred.id,
        instrument: w.instrument,
        message,
        severity:
          impact.confidence >= 0.8
            ? ("critical" as const)
            : impact.confidence >= 0.5
            ? ("warning" as const)
            : ("info" as const),
      };
    })
    .filter(Boolean);

  if (alerts.length > 0) {
    await supabase.from("pulse_alerts").insert(alerts);
  }
}

export async function getEventWithPrediction(
  supabase: SupabaseClient,
  eventId: string
): Promise<EventWithPrediction | null> {
  const { data: event, error } = await supabase
    .from("pulse_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (error || !event) return null;

  const { data: pred } = await supabase
    .from("pulse_predictions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...(event as unknown as EventWithPrediction),
    affected_instruments: (event.affected_instruments as string[]) ?? [],
    prediction: pred
      ? {
          ...pred,
          instrument_impacts: (pred.instrument_impacts as Record<string, InstrumentImpact>) ?? {},
        }
      : null,
  };
}

const EVENT_CATEGORIES: EventCategory[] = [
  "fed",
  "macro",
  "geopolitical",
  "earnings",
  "sector",
  "commodities",
];

export async function getCorrelationGrid(
  supabase: SupabaseClient,
  instruments: string[],
  days: number
): Promise<CorrelationCell[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Fetch completed predictions with their events in the time window
  const { data: preds, error } = await supabase
    .from("pulse_predictions")
    .select("instrument_impacts, event_id")
    .eq("status", "complete")
    .gte("completed_at", since);

  if (error || !preds?.length) return [];

  // Fetch event categories for those prediction event IDs
  const eventIds = [...new Set(preds.map((p) => p.event_id))];
  const { data: events } = await supabase
    .from("pulse_events")
    .select("id, category")
    .in("id", eventIds);

  const categoryMap = new Map<string, EventCategory>(
    (events ?? []).map((e) => [e.id, e.category as EventCategory])
  );

  // Build grid
  const grid = new Map<string, CorrelationCell>();

  for (const pred of preds) {
    const category = categoryMap.get(pred.event_id);
    if (!category) continue;
    const impacts = (pred.instrument_impacts as Record<string, InstrumentImpact>) ?? {};

    for (const instrument of instruments) {
      const impact = impacts[instrument];
      if (!impact) continue;
      const key = `${instrument}::${category}`;

      const existing = grid.get(key) ?? {
        instrument,
        category,
        bullish_count: 0,
        bearish_count: 0,
        neutral_count: 0,
        net_score: 0,
      };

      if (impact.direction === "bullish") existing.bullish_count++;
      else if (impact.direction === "bearish") existing.bearish_count++;
      else existing.neutral_count++;

      existing.net_score = existing.bullish_count - existing.bearish_count;
      grid.set(key, existing);
    }
  }

  // Return all cells for all combinations (even empty ones)
  const cells: CorrelationCell[] = [];
  for (const instrument of instruments) {
    for (const category of EVENT_CATEGORIES) {
      const key = `${instrument}::${category}`;
      cells.push(
        grid.get(key) ?? {
          instrument,
          category,
          bullish_count: 0,
          bearish_count: 0,
          neutral_count: 0,
          net_score: 0,
        }
      );
    }
  }
  return cells;
}

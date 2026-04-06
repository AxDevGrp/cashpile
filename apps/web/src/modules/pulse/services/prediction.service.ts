/**
 * Direct Prediction Service — uses OpenAI GPT-4o to predict market impact
 * Replaces MiroFish multi-agent simulation with direct analysis
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIClient, DEFAULT_MODEL } from "@cashpile/ai";
import type { EventWithPrediction, CorrelationCell, EventCategory, PulseEvent } from "../types";
import type { InstrumentImpact } from "@cashpile/ai/pulse";
import { generateAlertMessage } from "@cashpile/ai/pulse";

const IMPACT_SYSTEM_PROMPT = `You are a senior macro analyst at a hedge fund.
Given a financial event, predict the directional impact on specified instruments.

Respond ONLY with valid JSON — no markdown, no commentary.

Schema:
{
  "summary": "2-3 sentence analysis of the event and expected market reaction",
  "analyst_consensus": "One sentence consensus view",
  "risk_factors": ["risk 1", "risk 2", "risk 3"],
  "instrument_impacts": [
    {
      "instrument": "ES",
      "direction": "bullish" | "bearish" | "neutral",
      "magnitude_pct": 1.5,
      "confidence": 0.75,
      "time_horizon": "1d" | "1w" | "1m",
      "rationale": "Why this instrument moves this way"
    }
  ]
}

Instruments you may analyze: ES, NQ, YM, RTY, CL, GC, SI, DXY, TLT, VIX, XLK, XLE, XLF, XLB, XLV

Direction guide:
- bullish: Expect 0.5-3% upward move
- bearish: Expect 0.5-3% downward move  
- neutral: Minimal impact expected

Confidence guide:
- 0.8-1.0: High confidence (direct causal link, historical precedent)
- 0.5-0.8: Moderate confidence (some uncertainty, mixed signals)
- 0.2-0.5: Low confidence (indirect impact, many variables)`;

interface DirectPredictionResult {
  summary: string;
  analyst_consensus: string;
  risk_factors: string[];
  instrument_impacts: InstrumentImpact[];
}

async function analyzeWithOpenAI(
  event: PulseEvent
): Promise<DirectPredictionResult> {
  const client = getOpenAIClient();

  const instrumentList = event.affected_instruments.join(", ");

  const userPrompt = `Event: ${event.title}
Category: ${event.category}
Severity: ${event.severity}
Summary: ${event.summary || "N/A"}
Source: ${event.source}
Published: ${event.published_at}

Predict market impact for these instruments: ${instrumentList}`;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: IMPACT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as Partial<DirectPredictionResult>;

  // Validate and normalize impacts
  const impacts: InstrumentImpact[] = (parsed.instrument_impacts ?? [])
    .filter((i) => event.affected_instruments.includes(i.instrument))
    .map((i) => ({
      instrument: i.instrument,
      direction: ["bullish", "bearish", "neutral"].includes(i.direction)
        ? i.direction
        : "neutral",
      magnitude_pct: Math.max(0, Math.min(10, Number(i.magnitude_pct) || 0)),
      confidence: Math.max(0, Math.min(1, Number(i.confidence) || 0.5)),
      time_horizon: ["1d", "1w", "1m"].includes(i.time_horizon)
        ? i.time_horizon
        : "1d",
      rationale: i.rationale || "No rationale provided",
    }));

  return {
    summary: parsed.summary || `Analysis of ${event.title}`,
    analyst_consensus: parsed.analyst_consensus || "Mixed signals",
    risk_factors: Array.isArray(parsed.risk_factors)
      ? parsed.risk_factors.slice(0, 5)
      : [],
    instrument_impacts: impacts,
  };
}

export async function triggerPrediction(
  supabase: SupabaseClient,
  eventId: string
): Promise<string> {
  // Fetch event
  const { data: event, error } = await supabase
    .from("pulse_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) throw new Error(`Event not found: ${eventId}`);

  // Create pending prediction
  const { data: pred, error: predErr } = await supabase
    .from("pulse_predictions")
    .insert({
      event_id: eventId,
      status: "running",
    })
    .select("id")
    .single();

  if (predErr) throw new Error(predErr.message);

  // Run analysis asynchronously (don't block)
  analyzeAndStore(supabase, pred.id, event as PulseEvent).catch(console.error);

  return pred.id;
}

async function analyzeAndStore(
  supabase: SupabaseClient,
  predictionId: string,
  event: PulseEvent
): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await analyzeWithOpenAI(event);
    const duration = Date.now() - startTime;

    const impactsMap: Record<string, InstrumentImpact> = {};
    for (const impact of result.instrument_impacts) {
      impactsMap[impact.instrument] = impact;
    }

    const reportJson = {
      summary: result.summary,
      analyst_consensus: result.analyst_consensus,
      risk_factors: result.risk_factors,
      instrument_impacts: result.instrument_impacts,
      simulation_rounds: 1, // Direct analysis, not multi-agent
      generated_at: new Date().toISOString(),
    };

    // Update prediction as complete
    await supabase
      .from("pulse_predictions")
      .update({
        status: "complete",
        report_json: reportJson as unknown as Record<string, unknown>,
        instrument_impacts: impactsMap as unknown as Record<string, unknown>,
        completed_at: new Date().toISOString(),
        simulation_duration_ms: duration,
      })
      .eq("id", predictionId);

    // Generate alerts for watchlisted users
    await generateAlerts(supabase, event, predictionId, impactsMap);
  } catch (err) {
    console.error("Prediction analysis failed:", err);
    await supabase
      .from("pulse_predictions")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", predictionId);
  }
}

async function generateAlerts(
  supabase: SupabaseClient,
  event: PulseEvent,
  predictionId: string,
  impactsMap: Record<string, InstrumentImpact>
): Promise<void> {
  const affectedInstruments = Object.keys(impactsMap);
  if (affectedInstruments.length === 0) return;

  // Find users watching these instruments
  const { data: watchlistItems } = await supabase
    .from("pulse_watchlist")
    .select("user_id, instrument, alert_threshold_pct")
    .in("instrument", affectedInstruments)
    .eq("is_active", true);

  if (!watchlistItems?.length) return;

  const alerts = watchlistItems
    .map((w) => {
      const impact = impactsMap[w.instrument];
      if (!impact) return null;

      // Only alert if magnitude exceeds threshold
      if (impact.magnitude_pct < (w.alert_threshold_pct || 1.0)) {
        return null;
      }

      const message = generateAlertMessage(
        event.title,
        w.instrument,
        impact.direction,
        impact.magnitude_pct,
        impact.confidence
      );

      return {
        user_id: w.user_id,
        event_id: event.id,
        prediction_id: predictionId,
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
          instrument_impacts:
            (pred.instrument_impacts as Record<string, InstrumentImpact>) ?? {},
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

  const { data: preds, error } = await supabase
    .from("pulse_predictions")
    .select("instrument_impacts, event_id")
    .eq("status", "complete")
    .gte("completed_at", since);

  if (error || !preds?.length) return [];

  const eventIds = [...new Set(preds.map((p) => p.event_id))];
  const { data: events } = await supabase
    .from("pulse_events")
    .select("id, category")
    .in("id", eventIds);

  const categoryMap = new Map<string, EventCategory>(
    (events ?? []).map((e) => [e.id, e.category as EventCategory])
  );

  const grid = new Map<string, CorrelationCell>();

  for (const pred of preds) {
    const category = categoryMap.get(pred.event_id);
    if (!category) continue;

    const impacts =
      (pred.instrument_impacts as Record<string, InstrumentImpact>) ?? {};

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

/**
 * Event Analyzer — uses DeepSeek to extract structured data from raw news text.
 * Returns typed objects ready to insert into pulse_events.
 */

import { z } from "zod";
import { getOpenAIClient, DEFAULT_MODEL } from "../client";
import type { FinancialEvent } from "./seed-formatter";

export interface AnalyzedEvent {
  title: string;
  summary: string | null;
  category: FinancialEvent["category"];
  severity: FinancialEvent["severity"];
  affected_instruments: string[];
  raw_text: string;
}

// ─── Structured Output Schema ────────────────────────────────────────────────

const AnalyzedEventSchema = z.object({
  title: z.string().min(1).max(120).describe("Concise headline (max 120 chars)"),
  summary: z.string().min(10).max(500).nullable().describe("2-3 sentences explaining the event"),
  category: z.enum(["fed", "macro", "geopolitical", "earnings", "sector", "commodities"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affected_instruments: z.array(z.enum(["ES", "NQ", "YM", "RTY", "CL", "GC", "SI", "DXY", "TLT", "VIX", "XLK", "XLE", "XLF", "XLB", "XLV"])),
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior macro analyst at a hedge fund. 
Given raw financial news text, extract structured information in JSON.
Respond ONLY with valid JSON matching the schema — no markdown, no commentary.

Schema:
{
  "title": "concise headline (max 120 chars)",
  "summary": "2-3 sentences explaining the event and its market significance",
  "category": one of ["fed","macro","geopolitical","earnings","sector","commodities"],
  "severity": one of ["low","medium","high","critical"],
  "affected_instruments": array of instrument tickers from: [ES, NQ, YM, RTY, CL, GC, SI, DXY, TLT, VIX, XLK, XLE, XLF, XLB, XLV]
}

severity guide:
- critical: Fed rate changes, major geopolitical escalations, systemic financial events
- high: Significant macro data (CPI, jobs), major earnings beats/misses, central bank signals
- medium: Sector-specific news, moderate data releases, routine policy updates
- low: Minor news, analyst upgrades/downgrades, low-impact data`;

// ─── Analysis Function ───────────────────────────────────────────────────────

export async function analyzeEventFromText(
  rawText: string,
  source: string
): Promise<AnalyzedEvent> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source: ${source}\n\nNews text:\n${rawText.slice(0, 3000)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  // Validate with Zod schema
  const validated = AnalyzedEventSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("Event analysis validation failed:", validated.error);
    // Return fallback result
    return {
      title: rawText.slice(0, 100),
      summary: null,
      category: "macro",
      severity: "medium",
      affected_instruments: [],
      raw_text: rawText,
    };
  }

  return {
    ...validated.data,
    raw_text: rawText,
  };
}

export function generateAlertMessage(
  eventTitle: string,
  instrument: string,
  direction: "bullish" | "bearish" | "neutral",
  magnitudePct: number,
  confidence: number
): string {
  const directionLabel =
    direction === "bullish" ? "bullish" : direction === "bearish" ? "bearish" : "neutral";
  const confLabel =
    confidence >= 0.8 ? "high confidence" : confidence >= 0.5 ? "moderate confidence" : "low confidence";
  return (
    `${instrument}: ${directionLabel} signal (${magnitudePct.toFixed(1)}% move, ${confLabel}) — ` +
    `triggered by: "${eventTitle}"`
  );
}

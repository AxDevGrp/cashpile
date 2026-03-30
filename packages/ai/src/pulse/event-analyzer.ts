/**
 * Event Analyzer — uses OpenAI GPT-4o to extract structured data from raw news text.
 * Returns typed objects ready to insert into pulse_events.
 */

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
  const parsed = JSON.parse(content) as {
    title?: string;
    summary?: string;
    category?: string;
    severity?: string;
    affected_instruments?: string[];
  };

  return {
    title: parsed.title ?? rawText.slice(0, 100),
    summary: parsed.summary ?? null,
    category: (parsed.category as AnalyzedEvent["category"]) ?? "macro",
    severity: (parsed.severity as AnalyzedEvent["severity"]) ?? "medium",
    affected_instruments: parsed.affected_instruments ?? [],
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

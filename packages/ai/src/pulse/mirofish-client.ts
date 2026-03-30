/**
 * MiroFish HTTP client — bridges the Next.js app to the deployed MiroFish Python service.
 * Requires env vars: MIROFISH_URL, MIROFISH_API_KEY, MIROFISH_WEBHOOK_SECRET
 */

import type { MiroFishSeed } from "./seed-formatter";
import type { PredictionReport, InstrumentImpact } from "./types-shared";

// Re-export types for convenience
export type { PredictionReport, InstrumentImpact };

function getBaseUrl(): string {
  const url = process.env.MIROFISH_URL;
  if (!url) throw new Error("MIROFISH_URL env var is not set");
  return url.replace(/\/$/, "");
}

function getApiKey(): string {
  return process.env.MIROFISH_API_KEY ?? "";
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  };
}

export interface MiroFishJobStatus {
  job_id: string;
  status: "pending" | "running" | "complete" | "failed";
  report_json?: unknown;
  instrument_impacts?: Record<string, unknown>;
  error_message?: string;
  simulation_duration_ms?: number;
  completed_at?: string;
}

export async function submitJob(
  seed: MiroFishSeed,
  callbackUrl: string
): Promise<{ job_id: string }> {
  const res = await fetch(`${getBaseUrl()}/api/simulate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ ...seed, callback_url: callbackUrl }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiroFish submitJob failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{ job_id: string }>;
}

export async function getJobStatus(jobId: string): Promise<MiroFishJobStatus> {
  const res = await fetch(`${getBaseUrl()}/api/jobs/${jobId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiroFish getJobStatus failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<MiroFishJobStatus>;
}

export function parseImpactReport(rawReport: unknown): PredictionReport {
  const r = rawReport as Record<string, unknown>;

  const rawImpacts = (r.instrument_impacts ?? r.impacts ?? []) as Record<string, unknown>[];

  const instrument_impacts: InstrumentImpact[] = Array.isArray(rawImpacts)
    ? rawImpacts.map((i) => ({
        instrument: String(i.instrument ?? ""),
        direction: (i.direction as InstrumentImpact["direction"]) ?? "neutral",
        magnitude_pct: Number(i.magnitude_pct ?? i.magnitude ?? 0),
        confidence: Number(i.confidence ?? 0.5),
        time_horizon: (i.time_horizon as InstrumentImpact["time_horizon"]) ?? "1d",
        rationale: String(i.rationale ?? ""),
      }))
    : [];

  return {
    summary: String(r.summary ?? ""),
    analyst_consensus: String(r.analyst_consensus ?? r.consensus ?? ""),
    risk_factors: Array.isArray(r.risk_factors) ? (r.risk_factors as string[]) : [],
    instrument_impacts,
    simulation_rounds: Number(r.simulation_rounds ?? 0),
    generated_at: String(r.generated_at ?? new Date().toISOString()),
  };
}

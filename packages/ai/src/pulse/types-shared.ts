/**
 * Shared Pulse impact types used by both @cashpile/ai and apps/web.
 * Kept here to avoid circular package dependencies.
 */

export type ImpactDirection = "bullish" | "bearish" | "neutral";
export type TimeHorizon = "immediate" | "1d" | "1w";

export interface InstrumentImpact {
  instrument: string;
  direction: ImpactDirection;
  magnitude_pct: number;
  confidence: number;       // 0–1
  time_horizon: TimeHorizon;
  rationale: string;
}

export interface PredictionReport {
  summary: string;
  analyst_consensus: string;
  risk_factors: string[];
  instrument_impacts: InstrumentImpact[];
  simulation_rounds: number;
  generated_at: string;
}

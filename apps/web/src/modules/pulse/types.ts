/**
 * Pulse module — shared TypeScript types
 * All DB types mirror the pulse_* tables in packages/db/migrations/004_pulse_module.sql
 */

// ─── Re-export shared impact types from @cashpile/ai/pulse ─────────────────
export type {
  InstrumentImpact,
  PredictionReport,
  ImpactDirection,
  TimeHorizon,
} from "@cashpile/ai/pulse";

import type { InstrumentImpact, PredictionReport } from "@cashpile/ai/pulse";

// ─── Enums ─────────────────────────────────────────────────────────────────

export type EventCategory = "fed" | "macro" | "geopolitical" | "earnings" | "sector" | "commodities";
export type EventSeverity = "low" | "medium" | "high" | "critical";
export type PredictionStatus = "pending" | "running" | "complete" | "failed";
export type AlertSeverity = "info" | "warning" | "critical";

// ─── Database row types ────────────────────────────────────────────────────

export interface PulseEvent {
  id: string;
  title: string;
  summary: string | null;
  category: EventCategory;
  source: string;
  source_url: string | null;
  raw_content: string | null;
  severity: EventSeverity;
  affected_instruments: string[];
  published_at: string;
  ingested_at: string;
  dedup_hash: string | null;
  created_at: string;
}

export interface PulsePrediction {
  id: string;
  event_id: string;
  mirofish_job_id: string | null;
  status: PredictionStatus;
  report_json: PredictionReport | null;
  instrument_impacts: Record<string, InstrumentImpact>;
  error_message: string | null;
  simulation_duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface PulseWatchlistItem {
  id: string;
  user_id: string;
  instrument: string;
  alert_threshold_pct: number;
  is_active: boolean;
  created_at: string;
}

export interface PulseAlert {
  id: string;
  user_id: string;
  event_id: string | null;
  prediction_id: string | null;
  instrument: string | null;
  message: string;
  severity: AlertSeverity;
  read_at: string | null;
  created_at: string;
}

// ─── Correlation grid ──────────────────────────────────────────────────────

export interface CorrelationCell {
  instrument: string;
  category: EventCategory;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  net_score: number;       // bullish - bearish (positive = net bullish bias)
}

// ─── Feed ingestion ────────────────────────────────────────────────────────

export interface FeedIngestionResult {
  ingested: number;
  skipped: number;
  errors: number;
  triggered_predictions: number;
}

// ─── Event with prediction (joined) ───────────────────────────────────────

export interface EventWithPrediction extends PulseEvent {
  prediction: PulsePrediction | null;
}

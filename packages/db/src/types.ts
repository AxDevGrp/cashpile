export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Shared ──────────────────────────────────────────────────────────────────

export type Plan = "free" | "books" | "trades" | "pulse" | "pro";
export type Module = "books" | "trades" | "pulse";

// ─── Books ───────────────────────────────────────────────────────────────────

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "investment"
  | "loan"
  | "other";

export type TransactionType = "debit" | "credit";
export type ImportSource = "csv" | "excel" | "plaid" | "manual";

export type CategoryType =
  | "income"
  | "expense"
  | "asset"
  | "liability"
  | "equity";

export type EntityType =
  | "llc"
  | "rental_property"
  | "corporation"
  | "s_corp"
  | "partnership"
  | "sole_proprietorship";

// ─── Trades ──────────────────────────────────────────────────────────────────

export type TradeDirection = "long" | "short";

// ─── Pulse ───────────────────────────────────────────────────────────────────

export type EventCategory =
  | "fed"
  | "macro"
  | "geopolitical"
  | "earnings"
  | "sector"
  | "commodities";

export type EventSeverity = "low" | "medium" | "high" | "critical";

export type PredictionStatus = "pending" | "running" | "complete" | "failed";

// ─── Database interface (will be replaced by supabase gen types) ─────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: Plan;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan: Plan;
          stripe_subscription_id?: string | null;
        };
        Update: {
          plan?: Plan;
          stripe_subscription_id?: string | null;
        };
      };
      module_access: {
        Row: {
          id: string;
          user_id: string;
          module: Module;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          module: Module;
        };
        Update: Record<string, never>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

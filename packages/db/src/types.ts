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
export type CreditLedgerType = "subscription_grant" | "topup_grant" | "ai_deduction";

// Credits per plan (micro-dollars: 1 credit = $0.000001)
export const PLAN_MONTHLY_CREDITS: Record<Plan, number> = {
  free:   50_000,
  books:  3_000_000,
  trades: 3_000_000,
  pulse:  3_000_000,
  pro:    12_000_000,
};

// Topup blocks: USD amount → credits
export const TOPUP_CREDIT_AMOUNTS: Record<number, number> = {
  5:  5_000_000,
  10: 10_000_000,
  25: 25_000_000,
};

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
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
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
        Relationships: never[];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: Plan;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan: Plan;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Update: {
          plan?: Plan;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Relationships: never[];
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
        Relationships: never[];
      };
      // ─── Books tables ─n      // Note: books_business_entities is the Tax Entity table
      // Financial accounts can optionally belong to a Tax Entity via tax_entity_id
      books_business_entities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          entity_type: "llc" | "s_corp" | "c_corp" | "partnership" | "sole_proprietorship" | "rental_property";
          tax_id: string | null;
          address: Json | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          entity_type: "llc" | "s_corp" | "c_corp" | "partnership" | "sole_proprietorship" | "rental_property";
          tax_id?: string | null;
          address?: Json | null;
          description?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          entity_type?: "llc" | "s_corp" | "c_corp" | "partnership" | "sole_proprietorship" | "rental_property";
          tax_id?: string | null;
          address?: Json | null;
          description?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: never[];
      };
      // DEPRECATED: books_udas is being replaced by books_business_entities
      // Keeping for backward compatibility during migration
      books_udas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
        Relationships: never[];
      };
      // Financial accounts can optionally belong to a Tax Entity
      books_financial_accounts: {
        Row: {
          id: string;
          uda_id: string | null; // DEPRECATED: use tax_entity_id
          tax_entity_id: string | null; // NEW: links to books_business_entities
          name: string;
          account_type: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
          institution_name: string | null;
          last_four_digits: string | null;
          account_identifier: string | null;
          current_balance: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          uda_id?: string | null;
          tax_entity_id?: string | null;
          name: string;
          account_type: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
          institution_name?: string | null;
          last_four_digits?: string | null;
          account_identifier?: string | null;
          current_balance?: number;
          is_active?: boolean;
        };
        Update: {
          uda_id?: string | null;
          tax_entity_id?: string | null;
          name?: string;
          account_type?: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
          institution_name?: string | null;
          last_four_digits?: string | null;
          account_identifier?: string | null;
          current_balance?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: never[];
      };
      books_categories: {
        Row: {
          id: string;
          user_id: string;
          entity_id: string | null;
          name: string;
          parent_id: string | null;
          type: "income" | "expense" | "transfer";
          tax_category: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_id?: string | null;
          name: string;
          parent_id?: string | null;
          type: "income" | "expense" | "transfer";
          tax_category?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          parent_id?: string | null;
          type?: "income" | "expense" | "transfer";
          tax_category?: string | null;
          is_active?: boolean;
        };
        Relationships: never[];
      };
      books_transactions: {
        Row: {
          id: string;
          user_id: string;
          entity_id: string | null;
          account_id: string;
          category_id: string | null;
          date: string;
          description: string;
          merchant: string | null;
          amount: number;
          currency: string;
          type: "debit" | "credit";
          is_transfer: boolean;
          transfer_pair_id: string | null;
          import_source: string | null;
          import_batch_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_id?: string | null;
          account_id: string;
          category_id?: string | null;
          date: string;
          description: string;
          merchant?: string | null;
          amount: number;
          currency?: string;
          type: "debit" | "credit";
          is_transfer?: boolean;
          transfer_pair_id?: string | null;
          import_source?: string | null;
          import_batch_id?: string | null;
          notes?: string | null;
        };
        Update: {
          category_id?: string | null;
          description?: string;
          merchant?: string | null;
          amount?: number;
          date?: string;
          type?: "debit" | "credit";
          is_transfer?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      books_duplicate_fingerprints: {
        Row: {
          id: string;
          user_id: string;
          fingerprint: string;
          transaction_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fingerprint: string;
          transaction_id: string;
        };
        Update: Record<string, never>;
        Relationships: never[];
      };
      // Tax transaction assignments - links transactions to Tax Entities
      books_tax_transaction_views: {
        Row: {
          id: string;
          user_id: string;
          tax_entity_id: string; // Links to books_business_entities
          transaction_id: string;
          tax_amount: number | null;
          tax_description: string | null;
          tax_date: string | null;
          is_tax_deductible: boolean;
          business_percentage: number;
          deduction_percentage: number;
          tax_notes: string | null;
          category_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tax_entity_id: string;
          transaction_id: string;
          tax_amount?: number | null;
          tax_description?: string | null;
          tax_date?: string | null;
          is_tax_deductible?: boolean;
          business_percentage?: number;
          deduction_percentage?: number;
          tax_notes?: string | null;
          category_id?: number | null;
        };
        Update: {
          tax_amount?: number | null;
          tax_description?: string | null;
          tax_date?: string | null;
          is_tax_deductible?: boolean;
          business_percentage?: number;
          deduction_percentage?: number;
          tax_notes?: string | null;
          category_id?: number | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      // ─── Trades tables ───────────────────────────────────────────────
      trades_prop_accounts: {
        Row: {
          id: string;
          user_id: string;
          firm_name: string;
          account_label: string | null;
          account_size: number;
          starting_balance: number;
          current_balance: number;
          currency: string;
          max_daily_drawdown_pct: number;
          max_total_drawdown_pct: number;
          profit_target_pct: number | null;
          trailing_drawdown: boolean;
          status: "evaluation" | "funded" | "breached" | "passed" | "inactive";
          funded_rules: Record<string, unknown>;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          firm_name: string;
          account_label?: string | null;
          account_size: number;
          starting_balance: number;
          current_balance: number;
          currency?: string;
          max_daily_drawdown_pct?: number;
          max_total_drawdown_pct?: number;
          profit_target_pct?: number | null;
          trailing_drawdown?: boolean;
          status?: "evaluation" | "funded" | "breached" | "passed" | "inactive";
          funded_rules?: Record<string, unknown>;
          notes?: string | null;
        };
        Update: {
          firm_name?: string;
          account_label?: string | null;
          current_balance?: number;
          max_daily_drawdown_pct?: number;
          max_total_drawdown_pct?: number;
          profit_target_pct?: number | null;
          trailing_drawdown?: boolean;
          status?: "evaluation" | "funded" | "breached" | "passed" | "inactive";
          funded_rules?: Record<string, unknown>;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      trades_entries: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          instrument: string;
          direction: "long" | "short";
          entry_price: number;
          exit_price: number | null;
          size: number;
          entry_time: string;
          exit_time: string | null;
          gross_pnl: number | null;
          commissions: number;
          net_pnl: number | null;
          r_multiple: number | null;
          initial_stop: number | null;
          setup_tag: string | null;
          notes: string | null;
          screenshots: unknown[];
          tags: string[];
          is_open: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          instrument: string;
          direction: "long" | "short";
          entry_price: number;
          exit_price?: number | null;
          size: number;
          entry_time: string;
          exit_time?: string | null;
          gross_pnl?: number | null;
          commissions?: number;
          net_pnl?: number | null;
          r_multiple?: number | null;
          initial_stop?: number | null;
          setup_tag?: string | null;
          notes?: string | null;
          screenshots?: unknown[];
          tags?: string[];
          is_open?: boolean;
        };
        Update: {
          exit_price?: number | null;
          exit_time?: string | null;
          gross_pnl?: number | null;
          commissions?: number;
          net_pnl?: number | null;
          r_multiple?: number | null;
          setup_tag?: string | null;
          notes?: string | null;
          tags?: string[];
          is_open?: boolean;
          updated_at?: string;
        };
        Relationships: never[];
      };
      trades_sessions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          session_date: string;
          opening_balance: number;
          closing_balance: number | null;
          daily_pnl: number | null;
          drawdown_pct: number | null;
          trade_count: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          session_date: string;
          opening_balance: number;
          closing_balance?: number | null;
          daily_pnl?: number | null;
          drawdown_pct?: number | null;
          trade_count?: number;
          notes?: string | null;
        };
        Update: {
          closing_balance?: number | null;
          daily_pnl?: number | null;
          drawdown_pct?: number | null;
          trade_count?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      // ─── Pulse tables ────────────────────────────────────────────────
      pulse_events: {
        Row: {
          id: string;
          title: string;
          summary: string | null;
          category: "fed" | "macro" | "geopolitical" | "earnings" | "sector" | "commodities";
          source: string;
          source_url: string | null;
          raw_content: string | null;
          severity: "low" | "medium" | "high" | "critical";
          affected_instruments: Json;
          published_at: string;
          ingested_at: string;
          dedup_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          summary?: string | null;
          category: "fed" | "macro" | "geopolitical" | "earnings" | "sector" | "commodities";
          source: string;
          source_url?: string | null;
          raw_content?: string | null;
          severity?: "low" | "medium" | "high" | "critical";
          affected_instruments?: Json;
          published_at: string;
          ingested_at?: string;
          dedup_hash?: string | null;
        };
        Update: {
          summary?: string | null;
          severity?: "low" | "medium" | "high" | "critical";
          affected_instruments?: Json;
        };
        Relationships: never[];
      };
      pulse_predictions: {
        Row: {
          id: string;
          event_id: string;
          mirofish_job_id: string | null;
          status: "pending" | "running" | "complete" | "failed";
          report_json: Json | null;
          instrument_impacts: Json;
          error_message: string | null;
          simulation_duration_ms: number | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          mirofish_job_id?: string | null;
          status?: "pending" | "running" | "complete" | "failed";
          report_json?: Json | null;
          instrument_impacts?: Json;
          error_message?: string | null;
          simulation_duration_ms?: number | null;
          completed_at?: string | null;
        };
        Update: {
          mirofish_job_id?: string | null;
          status?: "pending" | "running" | "complete" | "failed";
          report_json?: Json | null;
          instrument_impacts?: Json;
          error_message?: string | null;
          simulation_duration_ms?: number | null;
          completed_at?: string | null;
        };
        Relationships: never[];
      };
      pulse_watchlist: {
        Row: {
          id: string;
          user_id: string;
          instrument: string;
          alert_threshold_pct: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          instrument: string;
          alert_threshold_pct?: number;
          is_active?: boolean;
        };
        Update: {
          alert_threshold_pct?: number;
          is_active?: boolean;
        };
        Relationships: never[];
      };
      pulse_alerts: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          prediction_id: string | null;
          instrument: string | null;
          message: string;
          severity: "info" | "warning" | "critical";
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          prediction_id?: string | null;
          instrument?: string | null;
          message: string;
          severity?: "info" | "warning" | "critical";
          read_at?: string | null;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: never[];
      };
      // ─── AI Credit tables ────────────────────────────────────────────
      ai_credit_balances: {
        Row: {
          user_id: string;
          subscription_credits: number;
          topup_credits: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          subscription_credits?: number;
          topup_credits?: number;
        };
        Update: {
          subscription_credits?: number;
          topup_credits?: number;
          updated_at?: string;
        };
        Relationships: never[];
      };
      ai_credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          type: CreditLedgerType;
          amount: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: CreditLedgerType;
          amount: number;
          metadata?: Json;
        };
        Update: Record<string, never>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

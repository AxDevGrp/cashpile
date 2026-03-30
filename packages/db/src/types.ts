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
      // ─── Books tables ────────────────────────────────────────────────
      books_entities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "individual" | "llc" | "s_corp" | "c_corp" | "partnership" | "sole_prop";
          tax_id: string | null;
          fiscal_year_start: number | null;
          default_currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "individual" | "llc" | "s_corp" | "c_corp" | "partnership" | "sole_prop";
          tax_id?: string | null;
          fiscal_year_start?: number | null;
          default_currency?: string;
        };
        Update: {
          name?: string;
          type?: "individual" | "llc" | "s_corp" | "c_corp" | "partnership" | "sole_prop";
          tax_id?: string | null;
          fiscal_year_start?: number | null;
          default_currency?: string;
          updated_at?: string;
        };
        Relationships: never[];
      };
      books_udas: {
        Row: {
          id: string;
          entity_id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
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
      books_accounts: {
        Row: {
          id: string;
          uda_id: string;
          user_id: string;
          name: string;
          institution: string | null;
          account_type: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          uda_id: string;
          user_id: string;
          name: string;
          institution?: string | null;
          account_type: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
          currency?: string;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          institution?: string | null;
          account_type?: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
          currency?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

/**
 * Trades module — shared TypeScript types
 * All DB types mirror the trades_* tables in packages/db/migrations/003_trades_module.sql
 */

// ─── Enums ─────────────────────────────────────────────────────────────────

export type AccountStatus = "evaluation" | "funded" | "breached" | "passed" | "inactive";
export type TradeDirection = "long" | "short";

// ─── Database row types ────────────────────────────────────────────────────

export interface TradesPropAccount {
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
  status: AccountStatus;
  funded_rules: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradesEntry {
  id: string;
  user_id: string;
  account_id: string;
  instrument: string;
  direction: TradeDirection;
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
}

export interface TradesSession {
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
}

// ─── Performance types ─────────────────────────────────────────────────────

export interface PerformanceStats {
  totalTrades: number;
  winRate: number;         // 0–100
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalNetPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgRMultiple: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  longWinRate: number;
  shortWinRate: number;
}

export interface EquityCurvePoint {
  date: string;            // YYYY-MM-DD
  balance: number;
  dailyPnl: number;
  drawdownPct: number;
}

export interface PnlByInstrument {
  instrument: string;
  netPnl: number;
  tradeCount: number;
  winRate: number;
  avgNetPnl: number;
}

export interface PnlBySetup {
  setupTag: string;
  netPnl: number;
  tradeCount: number;
  winRate: number;
  avgRMultiple: number;
}

// ─── Rules types ───────────────────────────────────────────────────────────

export interface DailyRulesStatus {
  date: string;
  dailyPnl: number;
  dailyLossPct: number;
  maxDailyLossPct: number;
  withinDailyLimit: boolean;
  totalDrawdownPct: number;
  maxTotalDrawdownPct: number;
  withinTotalLimit: boolean;
  withinLimits: boolean;
}

export interface RulesCheckResult {
  passed: boolean;
  breachedRules: string[];
  warnings: string[];
  dailyStatus: DailyRulesStatus | null;
  profitTargetPct: number | null;
  currentProfitPct: number;
}

// ─── Form input types ──────────────────────────────────────────────────────

export interface NewTradeInput {
  accountId: string;
  instrument: string;
  direction: TradeDirection;
  entryPrice: number;
  size: number;
  entryTime: string;
  initialStop?: number;
  commissions?: number;
  setupTag?: string;
  notes?: string;
  tags?: string[];
}

export interface CloseTradeInput {
  exitPrice: number;
  exitTime: string;
  grossPnl: number;
  commissions?: number;
}

export interface NewAccountInput {
  firmName: string;
  accountLabel?: string;
  accountSize: number;
  startingBalance: number;
  currency: string;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  profitTargetPct?: number;
  trailingDrawdown: boolean;
  status: AccountStatus;
  notes?: string;
}

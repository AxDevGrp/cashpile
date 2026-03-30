/**
 * Rules Service — Trades module
 * Checks prop-firm funded-account rules against live balance and trade data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyRulesStatus, RulesCheckResult } from "../types";

export class RulesService {
  constructor(private supabase: SupabaseClient) {}

  // ─── Daily loss status ──────────────────────────────────────────────────

  async getDailyStatus(
    userId: string,
    accountId: string,
    date?: string
  ): Promise<DailyRulesStatus | null> {
    const targetDate = date ?? new Date().toISOString().split("T")[0];

    // Get account limits
    const { data: account, error: aErr } = await this.supabase
      .from("trades_prop_accounts")
      .select(
        "starting_balance, current_balance, max_daily_drawdown_pct, max_total_drawdown_pct"
      )
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (aErr || !account) return null;

    // Get today's session
    const { data: session } = await this.supabase
      .from("trades_sessions")
      .select("daily_pnl, opening_balance")
      .eq("account_id", accountId)
      .eq("session_date", targetDate)
      .maybeSingle();

    // Fallback: sum closed trades today
    let dailyPnl = session?.daily_pnl ?? null;
    if (dailyPnl === null) {
      const { data: entries } = await this.supabase
        .from("trades_entries")
        .select("net_pnl")
        .eq("account_id", accountId)
        .eq("is_open", false)
        .gte("exit_time", `${targetDate}T00:00:00`)
        .lte("exit_time", `${targetDate}T23:59:59`);

      dailyPnl = (entries ?? []).reduce((s, e) => s + (e.net_pnl ?? 0), 0);
    }

    const openingBalance = session?.opening_balance ?? account.current_balance;
    const dailyLossPct =
      openingBalance > 0 ? (Math.abs(Math.min(dailyPnl, 0)) / openingBalance) * 100 : 0;

    const totalDrawdownPct =
      account.starting_balance > 0
        ? ((account.starting_balance - account.current_balance) / account.starting_balance) * 100
        : 0;

    const withinDailyLimit = dailyLossPct < account.max_daily_drawdown_pct;
    const withinTotalLimit = totalDrawdownPct < account.max_total_drawdown_pct;

    return {
      date: targetDate,
      dailyPnl,
      dailyLossPct,
      maxDailyLossPct: account.max_daily_drawdown_pct,
      withinDailyLimit,
      totalDrawdownPct,
      maxTotalDrawdownPct: account.max_total_drawdown_pct,
      withinTotalLimit,
      withinLimits: withinDailyLimit && withinTotalLimit,
    };
  }

  // ─── Total drawdown ──────────────────────────────────────────────────────

  async getTotalDrawdown(
    userId: string,
    accountId: string
  ): Promise<{ pct: number; amount: number; limit: number }> {
    const { data: account, error } = await this.supabase
      .from("trades_prop_accounts")
      .select("starting_balance, current_balance, max_total_drawdown_pct")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (error || !account) return { pct: 0, amount: 0, limit: 10 };

    const amount = account.starting_balance - account.current_balance;
    const pct =
      account.starting_balance > 0 ? (amount / account.starting_balance) * 100 : 0;

    return { pct, amount, limit: account.max_total_drawdown_pct };
  }

  // ─── Full rules check ────────────────────────────────────────────────────

  async checkAllRules(userId: string, accountId: string): Promise<RulesCheckResult> {
    const { data: account, error } = await this.supabase
      .from("trades_prop_accounts")
      .select(
        "starting_balance, current_balance, max_daily_drawdown_pct, max_total_drawdown_pct, profit_target_pct, status"
      )
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (error || !account) {
      return { passed: false, breachedRules: ["Account not found"], warnings: [], dailyStatus: null, profitTargetPct: null, currentProfitPct: 0 };
    }

    const breachedRules: string[] = [];
    const warnings: string[] = [];

    const dailyStatus = await this.getDailyStatus(userId, accountId);

    // Total drawdown
    const totalDrawdownPct =
      account.starting_balance > 0
        ? ((account.starting_balance - account.current_balance) / account.starting_balance) * 100
        : 0;

    if (totalDrawdownPct >= account.max_total_drawdown_pct) {
      breachedRules.push(
        `Total drawdown ${totalDrawdownPct.toFixed(2)}% exceeds max ${account.max_total_drawdown_pct}%`
      );
    } else if (totalDrawdownPct >= account.max_total_drawdown_pct * 0.8) {
      warnings.push(
        `Total drawdown ${totalDrawdownPct.toFixed(2)}% approaching limit (${account.max_total_drawdown_pct}%)`
      );
    }

    // Daily loss
    if (dailyStatus && !dailyStatus.withinDailyLimit) {
      breachedRules.push(
        `Daily loss ${dailyStatus.dailyLossPct.toFixed(2)}% exceeds max ${account.max_daily_drawdown_pct}%`
      );
    } else if (dailyStatus && dailyStatus.dailyLossPct >= account.max_daily_drawdown_pct * 0.8) {
      warnings.push(
        `Daily loss ${dailyStatus.dailyLossPct.toFixed(2)}% approaching daily limit`
      );
    }

    // Account status
    if (account.status === "breached") {
      breachedRules.push("Account is marked as breached");
    }

    // Profit target progress
    const currentProfitPct =
      account.starting_balance > 0
        ? ((account.current_balance - account.starting_balance) / account.starting_balance) * 100
        : 0;

    if (
      account.profit_target_pct !== null &&
      currentProfitPct >= account.profit_target_pct * 0.9 &&
      currentProfitPct < account.profit_target_pct
    ) {
      warnings.push(
        `Profit target ${currentProfitPct.toFixed(2)}% — close to target (${account.profit_target_pct}%)`
      );
    }

    return {
      passed: breachedRules.length === 0,
      breachedRules,
      warnings,
      dailyStatus,
      profitTargetPct: account.profit_target_pct,
      currentProfitPct,
    };
  }
}

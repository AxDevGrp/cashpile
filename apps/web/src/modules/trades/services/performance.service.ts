/**
 * Performance Service — Trades module
 * Computes trading stats from trades_entries and trades_sessions on-demand.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PerformanceStats,
  EquityCurvePoint,
  PnlByInstrument,
  PnlBySetup,
} from "../types";

export class PerformanceService {
  constructor(private supabase: SupabaseClient) {}

  // ─── Core stats ─────────────────────────────────────────────────────────

  async getStats(
    userId: string,
    accountId: string,
    from?: string,
    to?: string
  ): Promise<PerformanceStats> {
    let q = this.supabase
      .from("trades_entries")
      .select("net_pnl, gross_pnl, commissions, r_multiple, direction, is_open")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("is_open", false);

    if (from) q = q.gte("entry_time", from);
    if (to) q = q.lte("entry_time", to);

    const { data: entries, error } = await q;
    if (error) throw new Error(error.message);

    const closed = entries ?? [];
    if (closed.length === 0) {
      return {
        totalTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
        totalNetPnl: 0, bestTrade: 0, worstTrade: 0, avgRMultiple: 0,
        consecutiveWins: 0, consecutiveLosses: 0, longWinRate: 0, shortWinRate: 0,
      };
    }

    const wins = closed.filter((e) => (e.net_pnl ?? 0) > 0);
    const losses = closed.filter((e) => (e.net_pnl ?? 0) <= 0);

    const totalNetPnl = closed.reduce((s, e) => s + (e.net_pnl ?? 0), 0);
    const grossWins = wins.reduce((s, e) => s + (e.net_pnl ?? 0), 0);
    const grossLosses = Math.abs(losses.reduce((s, e) => s + (e.net_pnl ?? 0), 0));

    const avgWin = wins.length ? grossWins / wins.length : 0;
    const avgLoss = losses.length ? grossLosses / losses.length : 0;
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

    const netPnls = closed.map((e) => e.net_pnl ?? 0);
    const bestTrade = Math.max(...netPnls);
    const worstTrade = Math.min(...netPnls);

    const rMultiples = closed.filter((e) => e.r_multiple !== null).map((e) => e.r_multiple!);
    const avgRMultiple = rMultiples.length
      ? rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length
      : 0;

    // Consecutive wins/losses
    let currentWin = 0, currentLoss = 0, maxWin = 0, maxLoss = 0;
    for (const e of closed) {
      if ((e.net_pnl ?? 0) > 0) {
        currentWin++;
        currentLoss = 0;
        maxWin = Math.max(maxWin, currentWin);
      } else {
        currentLoss++;
        currentWin = 0;
        maxLoss = Math.max(maxLoss, currentLoss);
      }
    }

    // Long vs short win rates
    const longs = closed.filter((e) => e.direction === "long");
    const shorts = closed.filter((e) => e.direction === "short");
    const longWinRate = longs.length
      ? (longs.filter((e) => (e.net_pnl ?? 0) > 0).length / longs.length) * 100
      : 0;
    const shortWinRate = shorts.length
      ? (shorts.filter((e) => (e.net_pnl ?? 0) > 0).length / shorts.length) * 100
      : 0;

    return {
      totalTrades: closed.length,
      winRate: (wins.length / closed.length) * 100,
      avgWin,
      avgLoss,
      profitFactor,
      totalNetPnl,
      bestTrade,
      worstTrade,
      avgRMultiple,
      consecutiveWins: maxWin,
      consecutiveLosses: maxLoss,
      longWinRate,
      shortWinRate,
    };
  }

  // ─── Equity curve ────────────────────────────────────────────────────────

  async getEquityCurve(userId: string, accountId: string): Promise<EquityCurvePoint[]> {
    const { data: account, error: aErr } = await this.supabase
      .from("trades_prop_accounts")
      .select("starting_balance")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (aErr) throw new Error(aErr.message);

    const { data: sessions, error: sErr } = await this.supabase
      .from("trades_sessions")
      .select("session_date, opening_balance, closing_balance, daily_pnl, drawdown_pct")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .order("session_date", { ascending: true });

    if (sErr) throw new Error(sErr.message);

    const startingBalance = account?.starting_balance ?? 0;

    return (sessions ?? []).map((s) => {
      const balance = s.closing_balance ?? s.opening_balance;
      const drawdownPct =
        s.drawdown_pct ??
        (startingBalance > 0 ? ((startingBalance - balance) / startingBalance) * 100 : 0);
      return {
        date: s.session_date,
        balance,
        dailyPnl: s.daily_pnl ?? 0,
        drawdownPct,
      };
    });
  }

  // ─── P&L by instrument ───────────────────────────────────────────────────

  async getPnlByInstrument(userId: string, accountId: string): Promise<PnlByInstrument[]> {
    const { data, error } = await this.supabase
      .from("trades_entries")
      .select("instrument, net_pnl")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("is_open", false);

    if (error) throw new Error(error.message);

    const map = new Map<string, { pnl: number; count: number; wins: number }>();
    for (const e of data ?? []) {
      const prev = map.get(e.instrument) ?? { pnl: 0, count: 0, wins: 0 };
      map.set(e.instrument, {
        pnl: prev.pnl + (e.net_pnl ?? 0),
        count: prev.count + 1,
        wins: prev.wins + ((e.net_pnl ?? 0) > 0 ? 1 : 0),
      });
    }

    return Array.from(map.entries())
      .map(([instrument, { pnl, count, wins }]) => ({
        instrument,
        netPnl: pnl,
        tradeCount: count,
        winRate: count > 0 ? (wins / count) * 100 : 0,
        avgNetPnl: count > 0 ? pnl / count : 0,
      }))
      .sort((a, b) => b.netPnl - a.netPnl);
  }

  // ─── P&L by setup ────────────────────────────────────────────────────────

  async getPnlBySetup(userId: string, accountId: string): Promise<PnlBySetup[]> {
    const { data, error } = await this.supabase
      .from("trades_entries")
      .select("setup_tag, net_pnl, r_multiple")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("is_open", false)
      .not("setup_tag", "is", null);

    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      { pnl: number; count: number; wins: number; rSum: number; rCount: number }
    >();
    for (const e of data ?? []) {
      const tag = e.setup_tag!;
      const prev = map.get(tag) ?? { pnl: 0, count: 0, wins: 0, rSum: 0, rCount: 0 };
      map.set(tag, {
        pnl: prev.pnl + (e.net_pnl ?? 0),
        count: prev.count + 1,
        wins: prev.wins + ((e.net_pnl ?? 0) > 0 ? 1 : 0),
        rSum: prev.rSum + (e.r_multiple ?? 0),
        rCount: prev.rCount + (e.r_multiple !== null ? 1 : 0),
      });
    }

    return Array.from(map.entries())
      .map(([setupTag, { pnl, count, wins, rSum, rCount }]) => ({
        setupTag,
        netPnl: pnl,
        tradeCount: count,
        winRate: count > 0 ? (wins / count) * 100 : 0,
        avgRMultiple: rCount > 0 ? rSum / rCount : 0,
      }))
      .sort((a, b) => b.netPnl - a.netPnl);
  }
}

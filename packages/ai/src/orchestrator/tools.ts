import { tool } from "ai";
import { z } from "zod";
import { createServerSupabaseClient } from "@cashpile/db";

// ─── Period helpers ───────────────────────────────────────────────────────────

function periodStartDate(period: "mtd" | "ytd" | "last30"): string {
  const now = new Date();
  if (period === "mtd") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (period === "ytd") {
    return `${now.getFullYear()}-01-01`;
  }
  // last30
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ─── Tool factory ─────────────────────────────────────────────────────────────

export function createTools(userId: string) {
  return {
    // ── Books ──────────────────────────────────────────────────────────────
    get_books_summary: tool({
      description:
        "Fetch a summary of the user's Books (accounting) data: net cash flow, income, expenses, and top expense categories for the requested period.",
      parameters: z.object({
        period: z
          .enum(["mtd", "ytd", "last30"])
          .default("mtd")
          .describe("Time period: mtd = month-to-date, ytd = year-to-date, last30 = last 30 days"),
      }),
      execute: async ({ period }) => {
        const supabase = await createServerSupabaseClient();
        const since = periodStartDate(period);

        const [{ data: txns }, { data: accounts }] = await Promise.all([
          supabase
            .from("books_transactions")
            .select("id, amount, type, category_id, description, date")
            .eq("user_id", userId)
            .eq("is_transfer", false)
            .gte("date", since),
          supabase
            .from("books_accounts")
            .select("name, currency, account_type")
            .eq("user_id", userId)
            .eq("is_active", true),
        ]);

        const rows = txns ?? [];
        const income = rows
          .filter((t) => t.type === "credit")
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        const expenses = rows
          .filter((t) => t.type === "debit")
          .reduce((s, t) => s + Math.abs(t.amount), 0);

        // Tally by category_id
        const byCategory: Record<string, number> = {};
        for (const t of rows.filter((r) => r.type === "debit")) {
          const key = String(t.category_id ?? "uncategorized");
          byCategory[key] = (byCategory[key] ?? 0) + Math.abs(t.amount);
        }
        const topCategories = Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, amount]) => ({ category_id: id, amount: +amount.toFixed(2) }));

        return {
          period,
          since,
          transactionCount: rows.length,
          income: +income.toFixed(2),
          expenses: +expenses.toFixed(2),
          netCashFlow: +(income - expenses).toFixed(2),
          topExpenseCategories: topCategories,
          accounts: (accounts ?? []).map((a) => ({
            name: a.name,
            currency: a.currency,
            type: a.account_type,
          })),
        };
      },
    }),

    // ── Trades ─────────────────────────────────────────────────────────────
    get_trades_snapshot: tool({
      description:
        "Fetch the user's prop trading accounts status: P&L, drawdown percentage, breach status, win rate, and recent closed trades.",
      parameters: z.object({}),
      execute: async () => {
        const supabase = await createServerSupabaseClient();

        const { data: accounts } = await supabase
          .from("trades_prop_accounts")
          .select(
            "id, firm_name, account_label, starting_balance, current_balance, status, max_total_drawdown_pct"
          )
          .eq("user_id", userId)
          .neq("status", "inactive");

        const list = accounts ?? [];

        const accountSummaries = list.map((a) => {
          const pnl = a.current_balance - a.starting_balance;
          const drawdownPct =
            a.starting_balance > 0
              ? ((a.starting_balance - a.current_balance) / a.starting_balance) * 100
              : 0;
          return {
            label: `${a.firm_name} ${a.account_label ?? ""}`.trim(),
            startingBalance: +a.starting_balance.toFixed(2),
            currentBalance: +a.current_balance.toFixed(2),
            pnl: +pnl.toFixed(2),
            drawdownPct: +drawdownPct.toFixed(2),
            maxDrawdownPct: a.max_total_drawdown_pct,
            status: a.status,
            atRisk: drawdownPct >= a.max_total_drawdown_pct * 0.8,
          };
        });

        // Recent closed trades (last 20)
        const accountIds = list.map((a) => a.id);
        let recentTrades: Array<{
          instrument: string;
          direction: string;
          net_pnl: number | null;
          entry_time: string;
        }> = [];
        if (accountIds.length > 0) {
          const { data: trades } = await supabase
            .from("trades_entries")
            .select("instrument, direction, net_pnl, entry_time")
            .in("account_id", accountIds)
            .eq("is_open", false)
            .order("entry_time", { ascending: false })
            .limit(20);
          recentTrades = trades ?? [];
        }

        const wins = recentTrades.filter((t) => (t.net_pnl ?? 0) > 0).length;
        const winRate =
          recentTrades.length > 0
            ? +((wins / recentTrades.length) * 100).toFixed(1)
            : null;

        return {
          accountCount: list.length,
          totalPnl: +accountSummaries.reduce((s, a) => s + a.pnl, 0).toFixed(2),
          breachedCount: list.filter((a) => a.status === "breached").length,
          accounts: accountSummaries,
          recentTradeCount: recentTrades.length,
          winRate,
          recentTrades: recentTrades.slice(0, 5).map((t) => ({
            instrument: t.instrument,
            direction: t.direction,
            pnl: t.net_pnl != null ? +t.net_pnl.toFixed(2) : null,
          })),
        };
      },
    }),

    // ── Pulse events ───────────────────────────────────────────────────────
    get_pulse_events: tool({
      description:
        "Fetch recent macro/financial events from the Pulse module, optionally filtered by instruments. Includes MiroFish simulation results (instrument_impacts).",
      parameters: z.object({
        instruments: z
          .array(z.string())
          .optional()
          .describe(
            "Filter to events affecting these instruments (e.g. ['ES', 'CL', 'NQ']). Omit for all."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Number of events to return (default 10)"),
      }),
      execute: async ({ instruments, limit }) => {
        const supabase = await createServerSupabaseClient();

        // pulse_events.affected_instruments is Json; cast via select string
        let query = supabase
          .from("pulse_events")
          .select(
            "id, title, summary, category, severity, affected_instruments, published_at, source"
          )
          .order("published_at", { ascending: false })
          .limit(limit ?? 10);

        const { data: events } = await query;
        const eventList = events ?? [];

        // Filter by instruments client-side (affected_instruments is JSON array stored as Json)
        const filtered =
          instruments && instruments.length > 0
            ? eventList.filter((e) => {
                const arr = Array.isArray(e.affected_instruments)
                  ? (e.affected_instruments as string[])
                  : [];
                return instruments.some((i) => arr.includes(i));
              })
            : eventList;

        // Fetch completed predictions for these events
        let predictions: Array<{ event_id: string; instrument_impacts: unknown }> =
          [];
        if (filtered.length > 0) {
          const { data: preds } = await supabase
            .from("pulse_predictions")
            .select("event_id, instrument_impacts")
            .in(
              "event_id",
              filtered.map((e) => e.id)
            )
            .eq("status", "complete");
          predictions = preds ?? [];
        }

        const predsByEvent = predictions.reduce<Record<string, unknown>>(
          (acc, p) => {
            acc[p.event_id] = p.instrument_impacts;
            return acc;
          },
          {}
        );

        return {
          eventCount: filtered.length,
          events: filtered.map((e) => ({
            title: e.title,
            summary: e.summary,
            category: e.category,
            severity: e.severity,
            affectedInstruments: Array.isArray(e.affected_instruments)
              ? e.affected_instruments
              : [],
            source: e.source,
            publishedAt: e.published_at,
            instrumentImpacts: predsByEvent[e.id] ?? null,
          })),
        };
      },
    }),

    // ── Pulse alerts ───────────────────────────────────────────────────────
    get_pulse_alerts: tool({
      description:
        "Fetch the user's unread Pulse market alerts — personalized notifications based on their watchlist and active market events.",
      parameters: z.object({}),
      execute: async () => {
        const supabase = await createServerSupabaseClient();

        const { data: alerts } = await supabase
          .from("pulse_alerts")
          .select("id, instrument, message, severity, created_at, read_at")
          .eq("user_id", userId)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(20);

        const list = alerts ?? [];

        return {
          unreadCount: list.length,
          alerts: list.map((a) => ({
            instrument: a.instrument,
            message: a.message,
            severity: a.severity,
            createdAt: a.created_at,
          })),
        };
      },
    }),
  };
}

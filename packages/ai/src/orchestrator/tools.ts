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

    // ── Books: duplicates ──────────────────────────────────────────────────
    get_books_duplicates: tool({
      description:
        "Check the user's Books data for potential duplicate transactions. Returns the number of duplicate groups, total affected transactions, and a sample of the top duplicate fingerprints.",
      parameters: z.object({}),
      execute: async () => {
        const supabase = await createServerSupabaseClient();

        const { data: rows } = await supabase
          .from("books_duplicate_fingerprints")
          .select("fingerprint")
          .eq("user_id", userId);

        const counts: Record<string, number> = {};
        for (const r of rows ?? []) {
          counts[r.fingerprint] = (counts[r.fingerprint] ?? 0) + 1;
        }

        const dupeEntries = Object.entries(counts).filter(([, n]) => n > 1);
        const totalAffected = dupeEntries.reduce((s, [, n]) => s + n, 0);
        const sample = dupeEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([fingerprint, count]) => ({ fingerprint, count }));

        return {
          duplicateGroupCount: dupeEntries.length,
          totalAffectedTransactions: totalAffected,
          sample,
        };
      },
    }),

    // ── Books: uncategorized ───────────────────────────────────────────────
    get_books_uncategorized: tool({
      description:
        "Return the count of uncategorized Books transactions for a period, plus a sample so the AI can suggest categories. Only non-transfer transactions are included.",
      parameters: z.object({
        period: z
          .enum(["mtd", "ytd", "last30"])
          .default("mtd")
          .describe("Time period: mtd = month-to-date, ytd = year-to-date, last30 = last 30 days"),
      }),
      execute: async ({ period }) => {
        const supabase = await createServerSupabaseClient();
        const since = periodStartDate(period);

        const { data: uncatRows } = await supabase
          .from("books_transactions")
          .select("id, date, description, amount")
          .eq("user_id", userId)
          .eq("is_transfer", false)
          .is("category_id", null)
          .gte("date", since)
          .order("date", { ascending: false })
          .limit(20);

        return {
          period,
          since,
          uncategorizedCount: uncatRows?.length ?? 0,
          sample: (uncatRows ?? []).map((t) => ({
            id: t.id,
            date: t.date,
            description: t.description,
            amount: t.amount,
          })),
        };
      },
    }),

    // ── Books: bulk categorize ─────────────────────────────────────────────
    bulk_categorize_transactions: tool({
      description:
        "WRITE OPERATION — only call this after the user has explicitly confirmed. Applies a single category to a list of Books transaction IDs. Updates books_transactions.category_id for all provided IDs belonging to the current user.",
      parameters: z.object({
        transactionIds: z
          .array(z.string().uuid())
          .min(1)
          .max(200)
          .describe("List of books_transactions UUIDs to update (max 200)"),
        categoryId: z
          .string()
          .uuid()
          .describe("UUID of the books_categories row to assign"),
      }),
      execute: async ({ transactionIds, categoryId }) => {
        const supabase = await createServerSupabaseClient();

        const { data, error } = await supabase
          .from("books_transactions")
          .update({ category_id: categoryId })
          .in("id", transactionIds)
          .eq("user_id", userId)
          .select("id");

        if (error) throw new Error(error.message);

        return { updated: (data ?? []).length };
      },
    }),

    // ── Books: suggest transfers ───────────────────────────────────────────
    suggest_transfers: tool({
      description:
        "Scan recent Books transactions for cross-account debit/credit pairs that are likely internal transfers (same amount, close dates, opposite signs). Returns candidate pairs the user can review and link.",
      parameters: z.object({
        dateRangeDays: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(7)
          .describe("How many days apart two transactions can be to still be considered a pair (default 7)"),
        amountTolerance: z
          .number()
          .min(0)
          .max(10)
          .default(0.01)
          .describe("Maximum absolute difference in amounts to still consider a match (default 0.01)"),
      }),
      execute: async ({ dateRangeDays, amountTolerance }) => {
        const supabase = await createServerSupabaseClient();

        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        const { data: rows } = await supabase
          .from("books_transactions")
          .select("id, date, amount, description, account_id, is_transfer, transfer_pair_id")
          .eq("user_id", userId)
          .is("transfer_pair_id", null)
          .eq("is_transfer", false)
          .gte("date", sinceStr)
          .order("date", { ascending: false })
          .limit(500);

        const txns = rows ?? [];
        const candidates: Array<{
          debitId: string;
          creditId: string;
          amount: number;
          dateDiff: number;
          confidence: number;
        }> = [];
        const used = new Set<string>();

        for (let i = 0; i < txns.length; i++) {
          if (used.has(txns[i].id)) continue;
          const a = txns[i];
          const aAmt = Math.abs(a.amount);
          const aDate = new Date(a.date).getTime();

          for (let j = i + 1; j < txns.length; j++) {
            if (used.has(txns[j].id)) continue;
            const b = txns[j];
            // Must be opposite signs and different accounts
            if (Math.sign(a.amount) === Math.sign(b.amount)) continue;
            if (a.account_id === b.account_id) continue;

            const bAmt = Math.abs(b.amount);
            const bDate = new Date(b.date).getTime();
            const dateDiff = Math.abs(aDate - bDate) / 86_400_000;

            if (Math.abs(aAmt - bAmt) > amountTolerance) continue;
            if (dateDiff > dateRangeDays) continue;

            // Confidence: amount match + date proximity
            let confidence = 0.5; // base: amount matches
            confidence += Math.max(0, 1 - dateDiff / dateRangeDays) * 0.4;
            confidence += a.account_id !== b.account_id ? 0.1 : 0;

            const debit = a.amount < 0 ? a : b;
            const credit = a.amount > 0 ? a : b;

            candidates.push({
              debitId: debit.id,
              creditId: credit.id,
              amount: +aAmt.toFixed(2),
              dateDiff: +dateDiff.toFixed(1),
              confidence: +confidence.toFixed(2),
            });
            used.add(a.id);
            used.add(b.id);
            break;
          }
        }

        candidates.sort((a, b) => b.confidence - a.confidence);

        return {
          candidateCount: candidates.length,
          candidates: candidates.slice(0, 20),
        };
      },
    }),

    // ── Books: CSV export ──────────────────────────────────────────────────
    get_books_export: tool({
      description:
        "Generate an inline CSV of the user's Books transactions for a given period (max 500 rows). Returns the CSV as a string along with a row count and truncated flag. The AI can offer this to the user as a downloadable report.",
      parameters: z.object({
        period: z
          .enum(["mtd", "ytd", "last30"])
          .default("mtd")
          .describe("Time period: mtd = month-to-date, ytd = year-to-date, last30 = last 30 days"),
      }),
      execute: async ({ period }) => {
        const supabase = await createServerSupabaseClient();
        const since = periodStartDate(period);

        const { data: rawRows } = await supabase
          .from("books_transactions")
          .select(`
            id, date, description, merchant, amount, type, is_transfer, notes,
            books_categories ( name ),
            books_accounts ( name )
          `)
          .eq("user_id", userId)
          .gte("date", since)
          .order("date", { ascending: false })
          .limit(501); // fetch one extra to detect truncation

        type ExportRow = {
          id: string; date: string; description: string; merchant: string | null;
          amount: number; type: string; is_transfer: boolean; notes: string | null;
          books_categories: { name: string } | null;
          books_accounts: { name: string } | null;
        };
        const all = (rawRows ?? []) as unknown as ExportRow[];
        const truncated = all.length > 500;
        const exportRows = truncated ? all.slice(0, 500) : all;

        const escape = (v: unknown) => {
          const s = v == null ? "" : String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        };

        const header = "date,description,merchant,amount,type,category,account,is_transfer,notes";
        const csvRows = exportRows.map((t) => {
          const cat = (t as any).books_categories?.name ?? "";
          const acct = (t as any).books_accounts?.name ?? "";
          return [
            t.date, t.description, t.merchant ?? "", t.amount,
            t.type, cat, acct, t.is_transfer, t.notes ?? "",
          ]
            .map(escape)
            .join(",");
        });

        return {
          period,
          since,
          rowCount: exportRows.length,
          truncated,
          csv: [header, ...csvRows].join("\n"),
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

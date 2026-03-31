import {
  Bot, BookOpen, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, Minus,
  AlertTriangle, Bell,
} from "lucide-react";
import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { formatCurrency } from "@cashpile/ui";
import { generateCashboardBriefing } from "@cashpile/ai";
import { CashInputStrip } from "./_components/cash-input-strip";

// ─── Data helpers ────────────────────────────────────────────────────────────

async function getBooksMtd(userId: string) {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { data } = await supabase
    .from("books_transactions")
    .select("amount, type")
    .eq("user_id", userId)
    .eq("is_transfer", false)
    .gte("date", monthStart);
  const rows = data ?? [];
  const income = rows.filter((t) => t.type === "credit").reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses = rows.filter((t) => t.type === "debit").reduce((s, t) => s + Math.abs(t.amount), 0);
  return { income, expenses, net: income - expenses, count: rows.length };
}

async function getTradesSnapshot(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: accounts } = await supabase
    .from("trades_prop_accounts")
    .select("id, firm_name, account_label, starting_balance, current_balance, status, max_total_drawdown_pct")
    .eq("user_id", userId)
    .neq("status", "inactive");
  const list = accounts ?? [];
  const totalPnl = list.reduce((s, a) => s + (a.current_balance - a.starting_balance), 0);
  const worstDrawdown = list.reduce((worst, a) => {
    const pct = a.starting_balance > 0
      ? ((a.starting_balance - a.current_balance) / a.starting_balance) * 100
      : 0;
    return pct > worst ? pct : worst;
  }, 0);
  const breached = list.filter((a) => a.status === "breached").length;
  return { accounts: list, totalPnl, worstDrawdown, breached, count: list.length };
}

async function getPulseSnapshot(userId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ count: unread }, { data: events }] = await Promise.all([
    supabase.from("pulse_alerts").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("pulse_events").select("id, title, category, severity, published_at").order("published_at", { ascending: false }).limit(3),
  ]);
  return { unread: unread ?? 0, recentEvents: events ?? [] };
}

async function getRecentActivity(userId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: txns }, { data: trades }] = await Promise.all([
    supabase.from("books_transactions").select("id, date, description, amount, type").eq("user_id", userId).order("date", { ascending: false }).limit(5),
    supabase.from("trades_entries").select("id, instrument, direction, net_pnl, entry_time, is_open").eq("user_id", userId).eq("is_open", false).order("entry_time", { ascending: false }).limit(5),
  ]);
  return { txns: txns ?? [], trades: trades ?? [] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CATEGORY_COLORS: Record<string, string> = {
  fed:          "bg-blue-500/10 text-blue-400 border-blue-500/20",
  macro:        "bg-purple-500/10 text-purple-400 border-purple-500/20",
  geopolitical: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  earnings:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  sector:       "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  commodities:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [books, trades, pulse, activity, briefing] = await Promise.all([
    getBooksMtd(user.id).catch(() => null),
    getTradesSnapshot(user.id).catch(() => null),
    getPulseSnapshot(user.id).catch(() => ({ unread: 0, recentEvents: [] })),
    getRecentActivity(user.id).catch(() => ({ txns: [], trades: [] })),
    generateCashboardBriefing(user.id).catch(() => "Set up your modules to get your personalized AI briefing."),
  ]);

  const hasBooks  = books  && books.count > 0;
  const hasTrades = trades && trades.count > 0;
  const hasPulse  = pulse.recentEvents.length > 0 || pulse.unread > 0;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-6 pt-8 pb-4 max-w-7xl mx-auto w-full space-y-6">

        {/* ── AI Briefing card ─────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-violet-500/5 border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              C
            </div>
            <div>
              <div className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                <Bot className="h-3 w-3" /> Daily Briefing
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{briefing}</p>
            </div>
          </div>
        </div>

        {/* ── Module stat cards ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-4">

          {/* Books */}
          <Link href="/books/transactions" className="glass-card-hover rounded-2xl p-5 block group/card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                <BookOpen className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Books</span>
            </div>
            {hasBooks ? (
              <>
                <div className={`text-2xl font-bold font-mono mb-1 tabular-nums ${books!.net >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {books!.net >= 0 ? "+" : ""}{formatCurrency(books!.net)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {books!.net >= 0
                    ? <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                  Net cash flow MTD · {books!.count} txns
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold font-mono mb-1 text-muted-foreground">—</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Minus className="h-3 w-3" /> No transactions this month
                </div>
              </>
            )}
          </Link>

          {/* Trades */}
          <Link href="/trades/accounts" className="glass-card-hover rounded-2xl p-5 block group/card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                <TrendingUp className="h-4.5 w-4.5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Trades</span>
            </div>
            {hasTrades ? (
              <>
                <div className={`text-2xl font-bold font-mono mb-1 tabular-nums ${trades!.totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {trades!.totalPnl >= 0 ? "+" : ""}{formatCurrency(trades!.totalPnl)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {trades!.breached > 0
                    ? <AlertTriangle className="h-3 w-3 text-red-500" />
                    : <ArrowUpRight className="h-3 w-3" />}
                  {trades!.count} account{trades!.count > 1 ? "s" : ""} · {trades!.worstDrawdown.toFixed(1)}% max dd
                  {trades!.breached > 0 && <span className="text-red-500 ml-1">· {trades!.breached} breached</span>}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold font-mono mb-1 text-muted-foreground">—</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Minus className="h-3 w-3" /> No active accounts
                </div>
              </>
            )}
          </Link>

          {/* Pulse */}
          <Link href="/pulse/events" className="glass-card-hover rounded-2xl p-5 block group/card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center ring-1 ring-violet-500/20">
                <Activity className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Pulse</span>
            </div>
            {hasPulse ? (
              <>
                <div className={`text-2xl font-bold font-mono mb-1 tabular-nums ${pulse.unread > 0 ? "text-violet-500" : "text-foreground"}`}>
                  {pulse.unread > 0 ? pulse.unread : pulse.recentEvents.length}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {pulse.unread > 0
                    ? <><Bell className="h-3 w-3 text-violet-500" /> unread alert{pulse.unread > 1 ? "s" : ""}</>
                    : <><ArrowUpRight className="h-3 w-3" /> recent events</>}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold font-mono mb-1 text-muted-foreground">—</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Minus className="h-3 w-3" /> Awaiting first feed ingestion
                </div>
              </>
            )}
          </Link>
        </div>

        {/* ── Recent activity ───────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Recent transactions */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Transactions</h2>
              <Link href="/books/transactions" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">View all →</Link>
            </div>
            {activity.txns.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {activity.txns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                    <span className={`text-xs font-semibold font-mono tabular-nums shrink-0 ${t.type === "credit" ? "text-emerald-500" : "text-red-500"}`}>
                      {t.type === "credit" ? "+" : "-"}{formatCurrency(Math.abs(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent trades */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Trades</h2>
              <Link href="/trades/journal" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">View all →</Link>
            </div>
            {activity.trades.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No closed trades yet</p>
            ) : (
              <div className="space-y-3">
                {activity.trades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium font-mono">{t.instrument}</p>
                      <p className="text-xs text-muted-foreground capitalize">{t.direction} · {timeAgo(t.entry_time)}</p>
                    </div>
                    <span className={`text-xs font-semibold font-mono tabular-nums shrink-0 ${(t.net_pnl ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {(t.net_pnl ?? 0) >= 0 ? "+" : ""}{formatCurrency(t.net_pnl ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Pulse events */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Latest Events</h2>
              <Link href="/pulse/events" className="text-xs text-violet-500 hover:text-violet-400 transition-colors">View all →</Link>
            </div>
            {pulse.recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Awaiting first ingestion</p>
            ) : (
              <div className="space-y-3">
                {pulse.recentEvents.map((e) => (
                  <div key={e.id} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize border ${CATEGORY_COLORS[e.category] ?? "bg-muted/40 text-muted-foreground border-border"}`}>
                        {e.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(e.published_at)}</span>
                    </div>
                    <p className="text-xs font-medium line-clamp-1">{e.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cash AI input strip (always at bottom) ────────────────────────── */}
      <CashInputStrip />
    </div>
  );
}

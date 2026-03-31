import {
  Bot, BookOpen, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, Minus,
  AlertTriangle, Bell,
} from "lucide-react";
import { PageHeader } from "@cashpile/ui";
import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { formatCurrency } from "@cashpile/ui";

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
    supabase
      .from("pulse_alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
    supabase
      .from("pulse_events")
      .select("id, title, category, severity, published_at")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);
  return { unread: unread ?? 0, recentEvents: events ?? [] };
}

async function getRecentActivity(userId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: txns }, { data: trades }] = await Promise.all([
    supabase
      .from("books_transactions")
      .select("id, date, description, amount, type")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("trades_entries")
      .select("id, instrument, direction, net_pnl, entry_time, is_open")
      .eq("user_id", userId)
      .eq("is_open", false)
      .order("entry_time", { ascending: false })
      .limit(5),
  ]);
  return { txns: txns ?? [], trades: trades ?? [] };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CATEGORY_COLORS: Record<string, string> = {
  fed: "bg-blue-100 text-blue-700",
  macro: "bg-purple-100 text-purple-700",
  geopolitical: "bg-orange-100 text-orange-700",
  earnings: "bg-green-100 text-green-700",
  sector: "bg-cyan-100 text-cyan-700",
  commodities: "bg-yellow-100 text-yellow-700",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [books, trades, pulse, activity] = await Promise.all([
    getBooksMtd(user.id).catch(() => null),
    getTradesSnapshot(user.id).catch(() => null),
    getPulseSnapshot(user.id).catch(() => ({ unread: 0, recentEvents: [] })),
    getRecentActivity(user.id).catch(() => ({ txns: [], trades: [] })),
  ]);

  const hasBooks = books && books.count > 0;
  const hasTrades = trades && trades.count > 0;
  const hasPulse = pulse.recentEvents.length > 0 || pulse.unread > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <PageHeader title="Cashboard" description="Your AI-powered financial command center" />

      {/* AI Briefing */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
            C
          </div>
          <div>
            <div className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
              <Bot className="h-3 w-3" /> AI Briefing
            </div>
            <p className="text-sm text-muted-foreground italic">
              {!hasBooks && !hasTrades && !hasPulse
                ? "Set up your modules to get your personalized AI briefing here."
                : `${pulse.unread > 0 ? `${pulse.unread} new Pulse alert${pulse.unread > 1 ? "s" : ""} require attention. ` : ""}${hasTrades && trades!.breached > 0 ? `${trades!.breached} trade account${trades!.breached > 1 ? "s" : ""} breached rules. ` : ""}${hasBooks ? `Books shows ${books!.net >= 0 ? "+" : ""}${formatCurrency(books!.net)} net cash flow MTD.` : ""}`}
            </p>
          </div>
        </div>
      </div>

      {/* Module stat cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Books */}
        <Link href="/books/transactions" className="bg-background rounded-xl border p-5 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground">Books</span>
          </div>
          {hasBooks ? (
            <>
              <div className={`text-2xl font-bold mb-1 ${books!.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {books!.net >= 0 ? "+" : ""}{formatCurrency(books!.net)}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {books!.net >= 0
                  ? <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                  : <ArrowDownRight className="h-3 w-3 text-red-600" />}
                Net cash flow MTD · {books!.count} transactions
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold mb-1 text-muted-foreground">—</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" /> No transactions this month
              </div>
            </>
          )}
        </Link>

        {/* Trades */}
        <Link href="/trades/accounts" className="bg-background rounded-xl border p-5 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs text-muted-foreground">Trades</span>
          </div>
          {hasTrades ? (
            <>
              <div className={`text-2xl font-bold mb-1 ${trades!.totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {trades!.totalPnl >= 0 ? "+" : ""}{formatCurrency(trades!.totalPnl)}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {trades!.breached > 0
                  ? <AlertTriangle className="h-3 w-3 text-red-500" />
                  : <ArrowUpRight className="h-3 w-3" />}
                {trades!.count} account{trades!.count > 1 ? "s" : ""} · {trades!.worstDrawdown.toFixed(1)}% max drawdown
                {trades!.breached > 0 && ` · ${trades!.breached} breached`}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold mb-1 text-muted-foreground">—</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" /> No active accounts
              </div>
            </>
          )}
        </Link>

        {/* Pulse */}
        <Link href="/pulse/events" className="bg-background rounded-xl border p-5 hover:border-violet-500/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-violet-600" />
            </div>
            <span className="text-xs text-muted-foreground">Pulse</span>
          </div>
          {hasPulse ? (
            <>
              <div className={`text-2xl font-bold mb-1 ${pulse.unread > 0 ? "text-violet-600" : ""}`}>
                {pulse.unread > 0 ? pulse.unread : pulse.recentEvents.length}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {pulse.unread > 0
                  ? <><Bell className="h-3 w-3 text-violet-600" /> unread alert{pulse.unread > 1 ? "s" : ""}</>
                  : <><ArrowUpRight className="h-3 w-3" /> recent events</>}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold mb-1 text-muted-foreground">—</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" /> Awaiting first feed ingestion
              </div>
            </>
          )}
        </Link>
      </div>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <div className="lg:col-span-1 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <Link href="/books/transactions" className="text-xs text-emerald-600 hover:underline">View all →</Link>
          </div>
          {activity.txns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {activity.txns.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${t.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.type === "credit" ? "+" : "-"}{formatCurrency(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent trades */}
        <div className="lg:col-span-1 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Trades</h2>
            <Link href="/trades/journal" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {activity.trades.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No closed trades yet</p>
          ) : (
            <div className="space-y-2">
              {activity.trades.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium font-mono">{t.instrument}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t.direction} · {timeAgo(t.entry_time)}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${(t.net_pnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {(t.net_pnl ?? 0) >= 0 ? "+" : ""}{formatCurrency(t.net_pnl ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Pulse events */}
        <div className="lg:col-span-1 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Latest Events</h2>
            <Link href="/pulse/events" className="text-xs text-violet-600 hover:underline">View all →</Link>
          </div>
          {pulse.recentEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Awaiting first ingestion</p>
          ) : (
            <div className="space-y-2">
              {pulse.recentEvents.map((e) => (
                <div key={e.id} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[e.category] ?? "bg-gray-100 text-gray-600"}`}>
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
  );
}

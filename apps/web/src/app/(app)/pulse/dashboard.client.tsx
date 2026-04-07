"use client";

import { 
  Activity, 
  Zap, 
  Bell, 
  BarChart2, 
  TrendingUp, 
  List, 
  RefreshCw,
  Lock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Globe,
  AlertTriangle,
  Newspaper,
  CheckCircle
} from "lucide-react";
import { PageHeader } from "@cashpile/ui";
import Link from "next/link";
import { useState, useTransition } from "react";
import { listEvents } from "@/modules/pulse/actions/event.actions";
import { getUnreadCount } from "@/modules/pulse/actions/alert.actions";
import { ingestFeeds } from "@/modules/pulse/actions/feed.actions";
import type { Plan } from "@cashpile/db";
import { 
  getAvailableInstruments, 
  getDefaultInstruments, 
  PULSE_INSTRUMENT_LIMITS,
  type Instrument 
} from "@/modules/pulse/config/plan-limits";

interface PulseDashboardProps {
  initialEvents: Awaited<ReturnType<typeof listEvents>>;
  initialUnreadCount: number;
  userPlan: Plan;
  userInstruments: string[];
}

interface PulseEvent {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  affected_instruments: string[];
  published_at: string;
}

function calculateSentiment(events: PulseEvent[]): {
  overall: "bullish" | "bearish" | "neutral";
  score: number;
} {
  const criticalCount = events.filter(e => e.severity === "critical").length;
  const highCount = events.filter(e => e.severity === "high").length;
  
  if (criticalCount > 0) return { overall: "bearish", score: -60 };
  if (highCount > 2) return { overall: "bearish", score: -30 };
  if (highCount > 0) return { overall: "neutral", score: -10 };
  return { overall: "bullish", score: 25 };
}

function getCategoryBreakdown(events: PulseEvent[]) {
  const counts: Record<string, number> = {};
  events.forEach(e => {
    counts[e.category] = (counts[e.category] || 0) + 1;
  });
  return counts;
}

export default function PulseDashboard({ 
  initialEvents, 
  initialUnreadCount,
  userPlan,
  userInstruments 
}: PulseDashboardProps) {
  const [recentEvents, setRecentEvents] = useState(initialEvents);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const [lastIngestResult, setLastIngestResult] = useState<{
    total_ingested?: number;
    rss?: { ingested: number; skipped: number; errors: number };
    x?: { ingested: number; skipped: number; errors: number };
    error?: string;
  } | null>(null);

  const planLimits = PULSE_INSTRUMENT_LIMITS[userPlan];
  const availableInstruments = getAvailableInstruments(userPlan);
  const defaultInstruments = getDefaultInstruments(userPlan);
  const activeInstruments = userInstruments.length > 0 ? userInstruments : defaultInstruments;

  const sentiment = calculateSentiment(recentEvents);
  const categoryBreakdown = getCategoryBreakdown(recentEvents);

  function handleManualIngest() {
    startTransition(async () => {
      try {
        console.log("Starting feed ingestion...");
        const result = await ingestFeeds();
        console.log("Ingest complete:", result);
        setLastIngestResult(result);
        
        // Refresh events and unread count
        const [newEvents, newUnread] = await Promise.all([
          listEvents({ limit: 10 }),
          getUnreadCount().catch(() => 0),
        ]);
        setRecentEvents(newEvents);
        setUnreadCount(newUnread);
        
        // Clear the notification after 5 seconds
        setTimeout(() => setLastIngestResult(null), 5000);
      } catch (err) {
        console.error("Manual ingest failed:", err);
        setLastIngestResult({ error: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    fed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    macro: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    geopolitical: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    earnings: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    sector: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
    commodities: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  };

  const SEVERITY_ICONS: Record<string, React.ReactNode> = {
    critical: <AlertTriangle className="h-4 w-4 text-red-600" />,
    high: <ArrowUpRight className="h-4 w-4 text-orange-600" />,
    medium: <Minus className="h-4 w-4 text-yellow-600" />,
    low: <Minus className="h-4 w-4 text-gray-400" />,
  };

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Pulse"
        description="Real-time market intelligence dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualIngest}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-full font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Pulling..." : "Pull Now"}
            </button>
            <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-800 px-2.5 py-1 rounded-full font-medium">
              <Zap className="h-3 w-3" /> {userPlan.toUpperCase()}
            </span>
          </div>
        }
      />

      {/* Pull Result */}
      {lastIngestResult && (
        <div className={`rounded-lg border p-4 ${
          'error' in lastIngestResult 
            ? "border-red-200 bg-red-50" 
            : lastIngestResult.total_ingested === 0
            ? "border-yellow-200 bg-yellow-50"
            : "border-green-200 bg-green-50"
        }`}>
          <div className="flex items-center gap-2">
            {'error' in lastIngestResult ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Pull failed</p>
                  <p className="text-xs text-red-600">{lastIngestResult.error}</p>
                </div>
              </>
            ) : lastIngestResult.total_ingested === 0 ? (
              <>
                <Minus className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-800">No new events found</p>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Pulled {lastIngestResult.total_ingested} new events
                  </p>
                  {(lastIngestResult as any).rss && (lastIngestResult as any).x && (
                    <p className="text-xs text-green-600">
                      RSS: {(lastIngestResult as any).rss.ingested} | X: {(lastIngestResult as any).x.ingested}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Market Sentiment Banner */}
      <div className={`rounded-xl border-2 p-4 ${
        sentiment.overall === "bullish" 
          ? "border-green-200 bg-green-50/50" 
          : sentiment.overall === "bearish"
          ? "border-red-200 bg-red-50/50"
          : "border-yellow-200 bg-yellow-50/50"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              sentiment.overall === "bullish" 
                ? "bg-green-100" 
                : sentiment.overall === "bearish"
                ? "bg-red-100"
                : "bg-yellow-100"
            }`}>
              {sentiment.overall === "bullish" && <TrendingUp className="h-6 w-6 text-green-600" />}
              {sentiment.overall === "bearish" && <TrendingUp className="h-6 w-6 text-red-600 rotate-180" />}
              {sentiment.overall === "neutral" && <Minus className="h-6 w-6 text-yellow-600" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Market Sentiment</p>
              <p className={`text-lg font-semibold capitalize ${
                sentiment.overall === "bullish" 
                  ? "text-green-700" 
                  : sentiment.overall === "bearish"
                  ? "text-red-700"
                  : "text-yellow-700"
              }`}>
                {sentiment.overall} ({sentiment.score > 0 ? "+" : ""}{sentiment.score})
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Based on {recentEvents.length} recent events</p>
            <Link href="/pulse/correlations" className="text-xs text-violet-600 hover:underline">
              View correlations
            </Link>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Events Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Breakdown */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {["fed", "macro", "geopolitical", "earnings", "sector", "commodities"].map((cat) => {
              const count = categoryBreakdown[cat] || 0;
              const colors = CATEGORY_COLORS[cat];
              return (
                <div key={cat} className={`rounded-lg border ${colors.border} ${colors.bg} p-2 text-center`}>
                  <p className={`text-xs font-medium uppercase ${colors.text}`}>{cat}</p>
                  <p className={`text-lg font-bold ${colors.text}`}>{count}</p>
                </div>
              );
            })}
          </div>

          {/* Recent Events */}
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Newspaper className="h-4 w-4" /> Recent Events
              </h3>
              <Link href="/pulse/events" className="text-xs text-violet-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y">
              {recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          CATEGORY_COLORS[event.category]?.bg.replace('50', '100') || "bg-gray-100"
                        } ${CATEGORY_COLORS[event.category]?.text || "text-gray-700"}`}>
                          {event.category}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(event.published_at)}</span>
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{event.title}</p>
                      {event.affected_instruments.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {event.affected_instruments.slice(0, 4).map((inst) => (
                            <span key={inst} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {inst}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {SEVERITY_ICONS[event.severity]}
                    </div>
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No events yet. Click "Pull Now" to ingest news.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - My Instruments */}
        <div className="space-y-6">
          {/* Active Instruments Card */}
          <div className="rounded-xl border bg-card">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" /> My Instruments
                </h3>
                <span className="text-xs text-muted-foreground">
                  {activeInstruments.length}/{planLimits.maxInstruments}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{planLimits.description}</p>
            </div>
            <div className="p-4 space-y-2">
              {activeInstruments.map((symbol) => {
                const instrument = availableInstruments.find(i => i.symbol === symbol);
                return (
                  <div key={symbol} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-mono font-semibold text-sm">{symbol}</p>
                      <p className="text-xs text-muted-foreground">{instrument?.name}</p>
                    </div>
                    <Link 
                      href={`/pulse/correlations?instrument=${symbol}`}
                      className="text-xs text-violet-600 hover:underline"
                    >
                      Analyze
                    </Link>
                  </div>
                );
              })}
              <Link
                href="/pulse/watchlist"
                className="flex items-center justify-center gap-1 w-full p-2 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors"
              >
                {planLimits.canSelectCustom ? "Customize Instruments" : "View All Instruments"}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Upgrade CTA for limited plans */}
          {(userPlan === "free" || userPlan === "books") && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-violet-900">Unlock More Instruments</p>
                  <p className="text-xs text-violet-700 mt-1">
                    Upgrade to Trades plan to select custom instruments and track up to 5 markets.
                  </p>
                  <Link 
                    href="/settings/billing" 
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-violet-700 hover:underline"
                  >
                    Upgrade
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">Quick Links</h3>
            <div className="space-y-1">
              <Link href="/pulse/watchlist" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                <span className="text-sm">Watchlist</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href="/pulse/alerts" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                <span className="text-sm">Alerts</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </Link>
              <Link href="/pulse/correlations" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                <span className="text-sm">Correlations</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

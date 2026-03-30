import { Activity, Zap, Bell, BarChart2, TrendingUp, List } from "lucide-react";
import { PageHeader } from "@cashpile/ui";
import Link from "next/link";
import { listEvents } from "@/modules/pulse/actions/event.actions";
import { getUnreadCount } from "@/modules/pulse/actions/alert.actions";

export default async function PulsePage() {
  const [recentEvents, unreadCount] = await Promise.all([
    listEvents({ limit: 3, severity: "high" }).catch(() => listEvents({ limit: 3 })),
    getUnreadCount().catch(() => 0),
  ]);

  const CATEGORY_COLORS: Record<string, string> = {
    fed: "bg-blue-100 text-blue-800",
    macro: "bg-purple-100 text-purple-800",
    geopolitical: "bg-orange-100 text-orange-800",
    earnings: "bg-green-100 text-green-800",
    sector: "bg-cyan-100 text-cyan-800",
    commodities: "bg-yellow-100 text-yellow-800",
  };

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Pulse"
        description="AI-powered market intelligence — global events mapped to market impact"
        actions={
          <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 px-2.5 py-1 rounded-full font-medium">
            <Zap className="h-3 w-3" /> Powered by MiroFish
          </span>
        }
      />

      {/* Unread alerts banner */}
      {unreadCount > 0 && (
        <Link
          href="/pulse/alerts?unread=1"
          className="flex items-center gap-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-4 hover:bg-violet-100 dark:hover:bg-violet-950/30 transition-colors"
        >
          <Bell className="h-4 w-4 text-violet-600 shrink-0" />
          <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
            {unreadCount} unread prediction alert{unreadCount > 1 ? "s" : ""} — click to view
          </span>
        </Link>
      )}

      {/* Latest high-severity events */}
      {recentEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Latest Events</h2>
            <Link href="/pulse/events" className="text-xs text-violet-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${
                        CATEGORY_COLORS[event.category] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {event.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(event.published_at)}</span>
                  </div>
                  <p className="text-sm font-medium line-clamp-1">{event.title}</p>
                  {event.affected_instruments.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {event.affected_instruments.slice(0, 5).map((inst) => (
                        <span key={inst} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {inst}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    event.severity === "critical"
                      ? "bg-red-100 text-red-700"
                      : event.severity === "high"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {event.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Module navigation */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            href: "/pulse/events",
            icon: List,
            label: "Events",
            desc: "Global financial event feed",
            color: "text-violet-600",
          },
          {
            href: "/pulse/correlations",
            icon: BarChart2,
            label: "Correlations",
            desc: "Event → market impact grid",
            color: "text-blue-600",
          },
          {
            href: "/pulse/watchlist",
            icon: TrendingUp,
            label: "Watchlist",
            desc: "Track specific instruments",
            color: "text-green-600",
          },
          {
            href: "/pulse/alerts",
            icon: Bell,
            label: "Alerts",
            desc: `Prediction notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`,
            color: unreadCount > 0 ? "text-red-500" : "text-orange-600",
          },
        ].map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-background rounded-xl border p-4 hover:border-violet-500/40 transition-colors"
          >
            <Icon className={`h-5 w-5 mb-2 ${color}`} />
            <div className="font-medium text-sm mb-1">{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </Link>
        ))}
      </div>

      {recentEvents.length === 0 && (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Activity className="h-7 w-7 text-violet-600 animate-pulse" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Pulse is warming up</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            The feed aggregator will ingest financial news every 15 minutes.
            Predictions will appear as MiroFish completes simulations.
          </p>
        </div>
      )}
    </div>
  );
}

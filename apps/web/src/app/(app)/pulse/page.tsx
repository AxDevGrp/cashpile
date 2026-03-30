import { Activity, Zap } from "lucide-react";
import { PageHeader, Badge } from "@cashpile/ui";
import Link from "next/link";

export default function PulsePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pulse"
        description="AI-powered market intelligence — global events mapped to market impact"
        actions={
          <Badge variant="pulse" className="flex items-center gap-1">
            <Zap className="h-3 w-3" /> Powered by MiroFish
          </Badge>
        }
      />
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
          <Activity className="h-7 w-7 text-violet-600 animate-pulse" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Pulse is warming up</h3>
        <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
          The feed aggregator is ingesting financial news and events. Predictions will appear as MiroFish completes simulations.
        </p>
        <div className="text-xs text-muted-foreground">Configure your watchlist to receive personalized alerts</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/pulse/events", label: "Events", desc: "Global financial event feed" },
          { href: "/pulse/correlations", label: "Correlations", desc: "Event → market impact grid" },
          { href: "/pulse/watchlist", label: "Watchlist", desc: "Track specific instruments" },
          { href: "/pulse/alerts", label: "Alerts", desc: "Prediction notifications" },
        ].map(({ href, label, desc }) => (
          <Link key={href} href={href} className="bg-background rounded-xl border p-4 hover:border-violet-500/40 transition-colors">
            <div className="font-medium text-sm mb-1">{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

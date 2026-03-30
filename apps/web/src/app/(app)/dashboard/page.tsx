import { Bot, BookOpen, TrendingUp, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PageHeader, Card, CardContent } from "@cashpile/ui";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" description="Your financial overview across all modules" />

      {/* AI Briefing */}
      <div className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">C</div>
          <div>
            <div className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
              <Bot className="h-3 w-3" /> AI Briefing
            </div>
            <p className="text-sm text-muted-foreground italic">
              Set up your modules to get your personalized AI briefing here.
            </p>
          </div>
        </div>
      </div>

      {/* Module stat cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { href: "/books", label: "Books", sub: "Net cash flow MTD", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-500/10", hover: "hover:border-emerald-500/40" },
          { href: "/trades", label: "Trades", sub: "Active account drawdown", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-500/10", hover: "hover:border-blue-500/40" },
          { href: "/pulse", label: "Pulse", sub: "Active market alerts", icon: Activity, color: "text-violet-600", bg: "bg-violet-500/10", hover: "hover:border-violet-500/40" },
        ].map(({ href, label, sub, icon: Icon, color, bg, hover }) => (
          <Link key={href} href={href} className={`bg-background rounded-xl border p-5 transition-colors ${hover}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-bold mb-1">—</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3" />{sub}
            </div>
          </Link>
        ))}
      </div>

      <div className="text-center py-8 text-muted-foreground text-sm">
        Set up your modules to start seeing your unified financial picture.
      </div>
    </div>
  );
}

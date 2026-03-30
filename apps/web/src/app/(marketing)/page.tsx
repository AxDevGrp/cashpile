import Link from "next/link";
import { ArrowRight, BookOpen, TrendingUp, Activity, Bot, Zap, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="font-bold text-lg">Cashpile.ai</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/books" className="hover:text-foreground transition-colors">Books</Link>
            <Link href="/trades" className="hover:text-foreground transition-colors">Trades</Link>
            <Link href="/pulse" className="hover:text-foreground transition-colors">Pulse</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-muted rounded-full px-3 py-1 text-sm text-muted-foreground mb-6">
          <Zap className="h-3 w-3 text-amber-500" />
          AI-First Financial Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          Your finances,{" "}
          <span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
            intelligently unified
          </span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
          AI accounting, prop firm trade tracking, and real-time market intelligence — built for the financially active entrepreneur and trader.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup" className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className="px-6 py-3 rounded-lg font-medium border hover:bg-accent transition-colors">View pricing</Link>
        </div>
      </section>

      {/* Modules */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { href: "/books", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/50", label: "Books", desc: "AI-powered accounting for traders and their businesses. Import transactions, auto-categorize, manage entities, and prep Schedule E." },
            { href: "/trades", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-500/10", border: "hover:border-blue-500/50", label: "Trades", desc: "Built for prop firm traders. Track funded accounts, monitor drawdown in real time, journal trades, and get AI pattern analysis." },
            { href: "/pulse", icon: Activity, color: "text-violet-600", bg: "bg-violet-500/10", border: "hover:border-violet-500/50", label: "Pulse", desc: "Swarm AI simulation maps global events — Fed decisions, geopolitical shifts, earnings — to their predicted market impact." },
          ].map(({ href, icon: Icon, color, bg, border, label, desc }) => (
            <div key={href} className={`rounded-xl border p-6 transition-colors ${border}`}>
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{label}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">{desc}</p>
              <Link href={href} className={`text-sm ${color} font-medium flex items-center gap-1`}>
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* AI cross-module */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4">One AI that sees your whole financial picture</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            The Cashpile AI connects all three modules. Ask anything and get answers that pull from your accounting, trade positions, and market predictions simultaneously.
          </p>
          <div className="max-w-lg mx-auto bg-background rounded-xl border p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &quot;Your FTMO account is at 3.8% drawdown — 0.2% from your daily limit. Pulse shows elevated volatility tied to tomorrow&apos;s CPI print. Your win rate on high-volatility days is 29%. Your Books show strong cash flow this month if you need to reset.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs">C</div>
            <span className="font-semibold text-sm">Cashpile.ai</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Cashpile. All rights reserved.</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" /> Bank-grade security
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, BookOpen, TrendingUp, Activity, Bot, Zap, Shield } from "lucide-react";

const landingStyles = `
  .cp-landing {
    min-height: 100vh;
    background:
      radial-gradient(circle at 10% 0%, rgba(24, 201, 154, 0.18), transparent 30%),
      radial-gradient(circle at 88% 4%, rgba(37, 99, 235, 0.13), transparent 32%),
      #f7f5ef;
    color: #101828;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .cp-landing * { box-sizing: border-box; }
  .cp-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    border-bottom: 1px solid rgba(226, 232, 240, 0.9);
    background: rgba(247, 245, 239, 0.82);
    backdrop-filter: blur(18px);
  }
  .cp-container {
    width: 100%;
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 1.5rem;
  }
  .cp-nav-inner {
    height: 4.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }
  .cp-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: #020617;
    text-decoration: none;
    font-weight: 950;
    letter-spacing: -0.03em;
  }
  .cp-logo-mark {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 0.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #18c99a, #2563eb);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 950;
    box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
  }
  .cp-nav-links,
  .cp-nav-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .cp-nav-links a,
  .cp-sign-in {
    color: #475569;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 750;
  }
  .cp-nav-links a:hover,
  .cp-sign-in:hover { color: #020617; }
  .cp-cta-small {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #101828;
    color: #fff;
    padding: 0.65rem 1rem;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 850;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
  }
  .cp-hero {
    padding: 5.5rem 1.5rem 4rem;
    text-align: center;
  }
  .cp-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    border: 1px solid #a7f3d0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    color: #047857;
    padding: 0.35rem 0.8rem;
    font-size: 0.82rem;
    font-weight: 850;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }
  .cp-hero-title {
    max-width: 58rem;
    margin: 1.35rem auto 0;
    color: #020617;
    font-size: clamp(3rem, 7vw, 6.75rem);
    line-height: 0.93;
    letter-spacing: -0.075em;
    font-weight: 950;
  }
  .cp-gradient-text {
    background: linear-gradient(90deg, #0f9f76, #2563eb, #7c3aed);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .cp-hero-copy {
    max-width: 46rem;
    margin: 1.35rem auto 0;
    color: #475569;
    font-size: clamp(1.05rem, 2vw, 1.35rem);
    line-height: 1.65;
  }
  .cp-hero-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.8rem;
    margin-top: 2rem;
  }
  .cp-primary-button,
  .cp-secondary-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 999px;
    padding: 0.9rem 1.25rem;
    text-decoration: none;
    font-weight: 900;
  }
  .cp-primary-button {
    background: #18c99a;
    color: #020617;
    box-shadow: 0 16px 34px rgba(24, 201, 154, 0.24);
  }
  .cp-secondary-button {
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #334155;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
  }
  .cp-modules {
    padding: 3.5rem 1.5rem 5rem;
  }
  .cp-module-grid {
    display: grid;
    gap: 1.25rem;
  }
  .cp-module-card,
  .cp-ai-card {
    border: 1px solid #fff;
    border-radius: 1.75rem;
    background: rgba(255, 255, 255, 0.92);
    padding: 1.5rem;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  }
  .cp-icon-box {
    width: 2.75rem;
    height: 2.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 1rem;
    margin-bottom: 1rem;
  }
  .cp-icon-emerald { color: #047857; background: #ecfdf5; }
  .cp-icon-blue { color: #1d4ed8; background: #eff6ff; }
  .cp-icon-violet { color: #6d28d9; background: #f5f3ff; }
  .cp-module-card h3 {
    margin: 0 0 0.55rem;
    color: #020617;
    font-size: 1.2rem;
    font-weight: 950;
    letter-spacing: -0.03em;
  }
  .cp-module-card p {
    margin: 0 0 1rem;
    color: #64748b;
    line-height: 1.6;
    font-size: 0.95rem;
  }
  .cp-card-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #0f9f76;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 900;
  }
  .cp-ai-section {
    padding: 5rem 1.5rem;
    background: rgba(255, 255, 255, 0.46);
    border-top: 1px solid rgba(226, 232, 240, 0.85);
    border-bottom: 1px solid rgba(226, 232, 240, 0.85);
    text-align: center;
  }
  .cp-ai-icon {
    width: 3.25rem;
    height: 3.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.25rem;
    border-radius: 1.1rem;
    background: #ecfdf5;
    color: #047857;
  }
  .cp-section-title {
    margin: 0;
    color: #020617;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1;
    letter-spacing: -0.055em;
    font-weight: 950;
  }
  .cp-section-copy {
    max-width: 44rem;
    margin: 1rem auto 0;
    color: #64748b;
    font-size: 1rem;
    line-height: 1.65;
  }
  .cp-ai-card {
    max-width: 42rem;
    margin: 2rem auto 0;
    text-align: left;
  }
  .cp-ai-card-row {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
  }
  .cp-ai-card p {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
    line-height: 1.7;
    font-style: italic;
  }
  .cp-footer {
    border-top: 1px solid rgba(226, 232, 240, 0.9);
    padding: 2rem 1.5rem;
    background: rgba(255, 255, 255, 0.6);
  }
  .cp-footer-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: #64748b;
    font-size: 0.8rem;
  }
  .cp-security {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  @media (max-width: 767px) {
    .cp-nav-links { display: none; }
    .cp-sign-in { display: none; }
  }
  @media (min-width: 768px) {
    .cp-module-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .cp-footer-inner { flex-direction: row; }
  }
`;

export default function LandingPage() {
  return (
    <div className="cp-landing min-h-screen bg-background">
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />
      {/* Nav */}
      <nav className="cp-nav fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="cp-container cp-nav-inner max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="cp-logo flex items-center gap-2">
            <div className="cp-logo-mark w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="font-bold text-lg">Cashpile.ai</span>
          </Link>
          <div className="cp-nav-links hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/books" className="hover:text-foreground transition-colors">Books</Link>
            <Link href="/trades" className="hover:text-foreground transition-colors">Trades</Link>
            <Link href="/pulse" className="hover:text-foreground transition-colors">Pulse</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="cp-nav-actions flex items-center gap-3">
            <Link href="/login" className="cp-sign-in text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="cp-cta-small text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="cp-hero pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="cp-pill inline-flex items-center gap-2 bg-muted rounded-full px-3 py-1 text-sm text-muted-foreground mb-6">
          <Zap size={14} />
          AI-First Financial Platform
        </div>
        <h1 className="cp-hero-title text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          Your finances,{" "}
          <span className="cp-gradient-text bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
            intelligently unified
          </span>
        </h1>
        <p className="cp-hero-copy text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
          AI accounting, prop firm trade tracking, and real-time market intelligence — built for the financially active entrepreneur and trader.
        </p>
        <div className="cp-hero-actions flex items-center justify-center gap-4">
          <Link href="/signup" className="cp-primary-button flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Start free <ArrowRight size={16} />
          </Link>
          <Link href="/pricing" className="cp-secondary-button px-6 py-3 rounded-lg font-medium border hover:bg-accent transition-colors">View pricing</Link>
        </div>
      </section>

      {/* Modules */}
      <section className="cp-modules py-20 px-6 max-w-7xl mx-auto">
        <div className="cp-container cp-module-grid grid md:grid-cols-3 gap-8">
          {[
            { href: "/books", icon: BookOpen, color: "text-emerald-600", iconClass: "cp-icon-emerald", border: "hover:border-emerald-500/50", label: "Books", desc: "AI-powered accounting for traders and their businesses. Import transactions, auto-categorize, manage entities, and prep Schedule E." },
            { href: "/trades", icon: TrendingUp, color: "text-blue-600", iconClass: "cp-icon-blue", border: "hover:border-blue-500/50", label: "Trades", desc: "Built for prop firm traders. Track funded accounts, monitor drawdown in real time, journal trades, and get AI pattern analysis." },
            { href: "/pulse", icon: Activity, color: "text-violet-600", iconClass: "cp-icon-violet", border: "hover:border-violet-500/50", label: "Pulse", desc: "Swarm AI simulation maps global events — Fed decisions, geopolitical shifts, earnings — to their predicted market impact." },
          ].map(({ href, icon: Icon, color, iconClass, border, label, desc }) => (
            <div key={href} className={`cp-module-card rounded-xl border p-6 transition-colors ${border}`}>
              <div className={`cp-icon-box ${iconClass}`}>
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{label}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">{desc}</p>
              <Link href={href} className={`cp-card-link text-sm ${color} font-medium flex items-center gap-1`}>
                Learn more <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* AI cross-module */}
      <section className="cp-ai-section py-20 px-6 bg-muted/30">
        <div className="cp-container max-w-7xl mx-auto text-center">
          <div className="cp-ai-icon w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Bot size={24} />
          </div>
          <h2 className="cp-section-title text-3xl font-bold mb-4">One AI that sees your whole financial picture</h2>
          <p className="cp-section-copy text-muted-foreground max-w-2xl mx-auto mb-8">
            The Cashpile AI connects all three modules. Ask anything and get answers that pull from your accounting, trade positions, and market predictions simultaneously.
          </p>
          <div className="cp-ai-card max-w-lg mx-auto bg-background rounded-xl border p-4 text-left">
            <div className="cp-ai-card-row flex items-start gap-3">
              <div className="cp-logo-mark w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &quot;Your FTMO account is at 3.8% drawdown — 0.2% from your daily limit. Pulse shows elevated volatility tied to tomorrow&apos;s CPI print. Your win rate on high-volatility days is 29%. Your Books show strong cash flow this month if you need to reset.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="cp-footer border-t py-12 px-6">
        <div className="cp-container cp-footer-inner max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="cp-logo flex items-center gap-2">
            <div className="cp-logo-mark w-6 h-6 rounded bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs">C</div>
            <span className="font-semibold text-sm">Cashpile.ai</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Cashpile. All rights reserved.</p>
          <div className="cp-security flex items-center gap-1 text-xs text-muted-foreground">
            <Shield size={13} /> Bank-grade security
          </div>
        </div>
      </footer>
    </div>
  );
}

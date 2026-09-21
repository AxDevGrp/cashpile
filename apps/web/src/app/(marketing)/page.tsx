import Link from "next/link";
import { ArrowRight, Bot, Landmark, Sparkles, Upload, Zap, Shield } from "lucide-react";
import WaitlistForm from "./waitlist-form";

const landingStyles = `
  .cp-landing {
    min-height: 100vh;
    background:
      radial-gradient(circle at 8% 10%, rgba(24, 201, 154, 0.20), transparent 28%),
      radial-gradient(circle at 92% 2%, rgba(37, 99, 235, 0.16), transparent 30%),
      linear-gradient(180deg, #f8f6ef 0%, #eef6f1 48%, #f8f6ef 100%);
    color: #08111f;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .cp-landing * { box-sizing: border-box; }
  .cp-container { width: 100%; max-width: 76rem; margin: 0 auto; padding: 0 1.5rem; }
  .cp-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    border-bottom: 1px solid rgba(226, 232, 240, 0.9);
    background: rgba(248, 246, 239, 0.84);
    backdrop-filter: blur(18px);
  }
  .cp-nav-inner { height: 4.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; }
  .cp-logo { display: inline-flex; align-items: center; gap: 0.65rem; color: #020617; text-decoration: none; font-weight: 950; letter-spacing: -0.03em; }
  .cp-logo-mark { width: 2.1rem; height: 2.1rem; border-radius: 0.75rem; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #18c99a, #2563eb); color: #fff; font-size: 0.85rem; font-weight: 950; box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22); }
  .cp-nav-links, .cp-nav-actions { display: flex; align-items: center; gap: 1rem; }
  .cp-nav-links a { color: #475569; text-decoration: none; font-size: 0.9rem; font-weight: 800; }
  .cp-nav-links a:hover { color: #020617; }
  .cp-cta-small { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #101828; color: #fff; padding: 0.65rem 1rem; text-decoration: none; font-size: 0.9rem; font-weight: 850; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18); }

  .cp-hero { padding: 4.75rem 0 3rem; }
  .cp-hero-grid { display: grid; gap: 2rem; align-items: center; }
  .cp-pill { display: inline-flex; align-items: center; gap: 0.5rem; width: fit-content; border: 1px solid #a7f3d0; border-radius: 999px; background: rgba(255, 255, 255, 0.82); color: #047857; padding: 0.38rem 0.85rem; font-size: 0.82rem; font-weight: 900; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }
  .cp-hero-title { max-width: 42rem; margin: 1.15rem 0 0; color: #020617; font-size: clamp(3.2rem, 7vw, 6.9rem); line-height: 0.88; letter-spacing: -0.08em; font-weight: 950; }
  .cp-gradient-text { background: linear-gradient(90deg, #0f9f76, #2563eb, #7c3aed); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .cp-hero-copy { max-width: 39rem; margin: 1.3rem 0 0; color: #334155; font-size: clamp(1.05rem, 2vw, 1.28rem); line-height: 1.62; }
  .cp-beta-note { max-width: 38rem; margin: 0.9rem 0 0; color: #64748b; font-size: 0.92rem; line-height: 1.55; }
  .cp-proof-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
  .cp-proof-pill { border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 999px; background: rgba(255,255,255,0.72); padding: 0.55rem 0.8rem; color: #475569; font-size: 0.84rem; font-weight: 800; }

  .cp-gremmy-card { position: relative; border: 1px solid rgba(255,255,255,0.92); border-radius: 2.25rem; background: rgba(255,255,255,0.82); box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12); padding: 1.4rem; overflow: hidden; }
  .cp-gremmy-card:before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 30% 0%, rgba(24,201,154,0.16), transparent 35%), radial-gradient(circle at 90% 12%, rgba(37,99,235,0.13), transparent 32%); pointer-events: none; }
  .cp-gremmy-inner { position: relative; display: grid; gap: 1rem; }
  .cp-gremmy-image-wrap { border-radius: 1.55rem; background: #f8f6ef; border: 1px solid rgba(226,232,240,0.9); padding: 0.8rem; }
  .cp-gremmy-image { display: block; width: 100%; border-radius: 1.1rem; object-fit: cover; }
  .cp-gremmy-bubble { border-radius: 1.25rem; background: #08111f; color: #fff; padding: 1rem; box-shadow: 0 16px 38px rgba(15, 23, 42, 0.22); }
  .cp-gremmy-bubble strong { display: block; font-size: 1rem; margin-bottom: 0.2rem; }
  .cp-gremmy-bubble span { color: #cbd5e1; font-size: 0.9rem; line-height: 1.45; }

  .cp-waitlist-form { width: min(100%, 38rem); margin: 1.7rem 0 0; display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; }
  .cp-waitlist-form input { min-width: 0; border: 1px solid #cbd5e1; border-radius: 999px; background: rgba(255, 255, 255, 0.94); color: #020617; padding: 0.95rem 1.15rem; font-size: 1rem; outline: none; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08); }
  .cp-waitlist-form input:focus { border-color: #18c99a; box-shadow: 0 0 0 4px rgba(24, 201, 154, 0.16); }
  .cp-waitlist-form button { border: 0; cursor: pointer; border-radius: 999px; background: #18c99a; color: #020617; padding: 0.95rem 1.25rem; font-weight: 950; box-shadow: 0 16px 34px rgba(24, 201, 154, 0.24); }
  .cp-waitlist-form button:disabled { opacity: 0.7; cursor: not-allowed; }
  .cp-form-success, .cp-form-error { grid-column: 1 / -1; margin: 0.25rem 0 0; font-size: 0.92rem; font-weight: 800; }
  .cp-form-success { color: #047857; }
  .cp-form-error { color: #dc2626; }

  .cp-section-eyebrow { color: #0f766e; font-size: 0.82rem; font-weight: 950; letter-spacing: 0.12em; text-transform: uppercase; }
  .cp-modules { padding: 3.5rem 0 5rem; }
  .cp-section-title { margin: 0.5rem 0 0; color: #020617; font-size: clamp(2rem, 4vw, 3rem); line-height: 1; letter-spacing: -0.055em; font-weight: 950; }
  .cp-section-copy { max-width: 44rem; margin: 1rem 0 0; color: #64748b; font-size: 1rem; line-height: 1.65; }
  .cp-module-grid { display: grid; gap: 1.25rem; margin-top: 1.5rem; }
  .cp-module-card, .cp-ai-card { border: 1px solid #fff; border-radius: 1.75rem; background: rgba(255, 255, 255, 0.92); padding: 1.5rem; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08); }
  .cp-icon-box { width: 2.75rem; height: 2.75rem; display: flex; align-items: center; justify-content: center; border-radius: 1rem; margin-bottom: 1rem; }
  .cp-icon-emerald { color: #047857; background: #ecfdf5; }
  .cp-icon-blue { color: #1d4ed8; background: #eff6ff; }
  .cp-icon-violet { color: #6d28d9; background: #f5f3ff; }
  .cp-module-card h3 { margin: 0 0 0.55rem; color: #020617; font-size: 1.2rem; font-weight: 950; letter-spacing: -0.03em; }
  .cp-module-card p { margin: 0 0 1rem; color: #64748b; line-height: 1.6; font-size: 0.95rem; }
  .cp-card-link { display: inline-flex; align-items: center; gap: 0.3rem; color: #0f9f76; text-decoration: none; font-size: 0.9rem; font-weight: 900; }

  .cp-ai-section { padding: 5rem 0; background: rgba(255, 255, 255, 0.46); border-top: 1px solid rgba(226, 232, 240, 0.85); border-bottom: 1px solid rgba(226, 232, 240, 0.85); }
  .cp-ai-icon { width: 3.25rem; height: 3.25rem; display: flex; align-items: center; justify-content: center; border-radius: 1.1rem; background: #ecfdf5; color: #047857; }
  .cp-ai-card { max-width: 42rem; margin-top: 2rem; }
  .cp-ai-card-row { display: flex; align-items: flex-start; gap: 0.85rem; }
  .cp-ai-card p { margin: 0; color: #475569; font-size: 0.95rem; line-height: 1.7; font-style: italic; }

  .cp-footer { border-top: 1px solid rgba(226, 232, 240, 0.9); padding: 2rem 0; background: rgba(255, 255, 255, 0.6); }
  .cp-footer-inner { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 1rem; color: #64748b; font-size: 0.8rem; }
  .cp-security { display: inline-flex; align-items: center; gap: 0.3rem; }

  @media (max-width: 767px) {
    .cp-nav-links { display: none; }
    .cp-waitlist-form { grid-template-columns: 1fr; }
  }
  @media (min-width: 768px) {
    .cp-hero-grid { grid-template-columns: minmax(0, 1.05fr) minmax(20rem, 0.75fr); }
    .cp-module-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .cp-footer-inner { flex-direction: row; }
  }
`;

export default function LandingPage() {
  return (
    <div className="cp-landing">
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />

      <nav className="cp-nav">
        <div className="cp-container cp-nav-inner">
          <Link href="/" className="cp-logo">
            <div className="cp-logo-mark">C</div>
            <span>Cashpile.ai</span>
          </Link>
          <div className="cp-nav-links">
            <a href="#modules">What it does</a>
            <a href="#ai">Meet Gremmy</a>
          </div>
          <div className="cp-nav-actions">
            <a href="#waitlist" className="cp-cta-small">Join waitlist</a>
          </div>
        </div>
      </nav>

      <main>
        <section className="cp-hero">
          <div className="cp-container cp-hero-grid">
            <div>
              <div className="cp-pill">
                <Zap size={14} />
                Private beta coming soon
              </div>
              <h1 className="cp-hero-title">
                Meet Gremmy, your {" "}
                <span className="cp-gradient-text">cash gremlin</span>
              </h1>
              <p className="cp-hero-copy">
                Import your finances, clean them up with AI, and see an actionable Cashboard to better your finances.
              </p>
              <WaitlistForm />
              <p className="cp-beta-note">
                We’re opening Cashpile.ai in private beta. Leave your email and Gremmy will save you a spot on the waiting list.
              </p>
              <div className="cp-proof-row">
                <div className="cp-proof-pill">Connect or import a CSV</div>
                <div className="cp-proof-pill">AI cleanup with your review</div>
                <div className="cp-proof-pill">Actionable cash outlook</div>
              </div>
            </div>

            <div className="cp-gremmy-card" id="waitlist">
              <div className="cp-gremmy-inner">
                <div className="cp-gremmy-image-wrap">
                  <img className="cp-gremmy-image" src="/assets/gremlin-v3-crop.png" alt="Gremmy, Cashpile's friendly cash gremlin mascot" />
                </div>
                <div className="cp-gremmy-bubble">
                  <strong>“I find the sneaky stuff.”</strong>
                  <span>Uncategorized transactions, duplicate imports, recurring charges, and cash dips — Gremmy helps you decide what to review next.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="cp-modules">
          <div className="cp-container">
            <div className="cp-section-eyebrow">What Gremmy helps with</div>
            <h2 className="cp-section-title">A clearer next step for your money.</h2>
            <p className="cp-section-copy">
              Start with the financial data you already have. Cashpile helps you organize it, review it with AI, and understand what to do next.
            </p>
            <div className="cp-module-grid">
              {[
                { icon: Upload, color: "text-emerald-600", iconClass: "cp-icon-emerald", border: "hover:border-emerald-500/50", label: "Import", desc: "Connect an account or upload a CSV to bring your transactions into one place." },
                { icon: Sparkles, color: "text-blue-600", iconClass: "cp-icon-blue", border: "hover:border-blue-500/50", label: "Clean up with AI", desc: "Review suggested categories, duplicate imports, and rules before applying changes." },
                { icon: Landmark, color: "text-violet-600", iconClass: "cp-icon-violet", border: "hover:border-violet-500/50", label: "Use your Cashboard", desc: "See spending, recurring charges, and an estimated cash outlook with concrete next actions." },
              ].map(({ icon: Icon, color, iconClass, border, label, desc }) => (
                <div key={label} className={`cp-module-card ${border}`}>
                  <div className={`cp-icon-box ${iconClass}`}>
                    <Icon size={22} />
                  </div>
                  <h3>{label}</h3>
                  <p>{desc}</p>
                  <a href="#waitlist" className={`cp-card-link ${color}`}>
                    Get beta access <ArrowRight size={14} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ai" className="cp-ai-section">
          <div className="cp-container">
            <div className="cp-ai-icon">
              <Bot size={24} />
            </div>
            <h2 className="cp-section-title">Gremmy is cute. The AI is serious.</h2>
            <p className="cp-section-copy">
              Ask what changed, what needs attention, and what to fix next. Gremmy uses your transactions and cash-flow data, then leaves the decision with you.
            </p>
            <div className="cp-ai-card">
              <div className="cp-ai-card-row">
                <div className="cp-logo-mark">G</div>
                <p>
                  “You have 7 transactions worth reviewing and a recurring charge that looks higher than usual. Want me to queue the cleanup?”
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cp-footer">
        <div className="cp-container cp-footer-inner">
          <div className="cp-logo">
            <div className="cp-logo-mark">C</div>
            <span>Cashpile.ai</span>
          </div>
          <p>© {new Date().getFullYear()} Cashpile. Beta coming soon.</p>
          <div className="cp-security">
            <Shield size={13} /> Built for careful financial workflows
          </div>
        </div>
      </footer>
    </div>
  );
}

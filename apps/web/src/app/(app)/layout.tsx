"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@cashpile/ui";
import { Toaster } from "sonner";
import { CashOverlayProvider } from "./_components/cash-overlay";

const NAV_PIN_KEY = "cashpile-nav-pinned";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore pinned state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAV_PIN_KEY);
      if (stored === "true") setPinned(true);
    } catch {}
  }, []);

  function handlePin() {
    const next = !pinned;
    setPinned(next);
    try { localStorage.setItem(NAV_PIN_KEY, String(next)); } catch {}
  }

  return (
    <CashOverlayProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar
          pinned={pinned}
          onPin={handlePin}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center h-14 border-b bg-white/85 backdrop-blur-sm px-4 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs">
                C
              </div>
              <span className="font-bold tracking-tight">Cashpile</span>
            </div>
          </div>

          <main
            className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(24,201,154,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_30%)]"
            data-agent-surface="cashpile-app"
            data-agent-modules="books,tax,cashflow,ai,settings"
            data-agent-capabilities-url="/api/agent/capabilities"
            data-agent-discovery-url="/.well-known/cashpile-agent.json"
          >
            {children}
          </main>
        </div>

        <Toaster richColors position="top-right" />
      </div>
    </CashOverlayProvider>
  );
}

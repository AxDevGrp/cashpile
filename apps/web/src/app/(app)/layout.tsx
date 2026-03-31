"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@cashpile/ui";
import { Toaster } from "sonner";
import { CashOverlayProvider } from "./_components/cash-overlay";

const NAV_PIN_KEY = "cashpile-nav-pinned";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(false); // icon-only by default
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
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          pinned={pinned}
          onPin={handlePin}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center h-14 border-b bg-background/95 backdrop-blur-sm px-4 shrink-0">
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

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>

        <Toaster richColors position="top-right" />
      </div>
    </CashOverlayProvider>
  );
}

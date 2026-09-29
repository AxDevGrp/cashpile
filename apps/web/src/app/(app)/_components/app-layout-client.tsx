"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  Bell,
  BookOpen,
  FileText,
  Home,
  Menu,
  MessageCircle,
  Settings,
} from "lucide-react";
import { Sidebar } from "@cashpile/ui";
import { Toaster } from "sonner";
import { createClient } from "@cashpile/db/client";
import { clearConsumerReviewStorage } from "@/components/ui-v2/consumer-model";
import { ConsumerExperienceContext } from "@/components/ui-v2/consumer-context";
import { CashOverlayProvider } from "./cash-overlay";
import { AppShellV2, type UiV2NavigationItem } from "@/components/ui-v2/components";
import { getAppNavigation, isUiV2Enabled } from "@/components/ui-v2/model";

const NAV_PIN_KEY = "cashpile-nav-pinned";

function SignOutButton() {
  const [pending, setPending] = useState(false);
  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Never leave the previous user's review progress behind.
        clearConsumerReviewStorage((key) => {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        }, user.id);
      }
      await supabase.auth.signOut();
    } catch {}
    window.location.href = "/login";
  }
  return (
    <button type="button" onClick={signOut} className="text-left" disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

const ICONS: Record<string, typeof Home> = {
  "/cashboard": Home,
  "/ai": MessageCircle,
  "/cashflow": Activity,
  "/books": BookOpen,
  "/books/tax": FileText,
  "/books/transactions": Activity,
  "/books/accounts": Banknote,
  "/settings": Settings,
  "/pulse/alerts": Bell,
};

export function AppLayoutClient({
  children,
  consumerEnabled,
}: {
  children: React.ReactNode;
  consumerEnabled: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const [pinned, setPinned] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTaxModule, setShowTaxModule] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAV_PIN_KEY);
      if (stored === "true") setPinned(true);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/features", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { canUseTax: false }))
      .then((data) => {
        if (!cancelled) setShowTaxModule(Boolean(data.canUseTax));
      })
      .catch(() => {
        if (!cancelled) setShowTaxModule(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handlePin() {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem(NAV_PIN_KEY, String(next));
    } catch {}
  }

  const navigation: UiV2NavigationItem[] = getAppNavigation(showTaxModule, consumerEnabled).map(
    (item) => ({
      ...item,
      icon: ICONS[item.href] ?? Home,
    }),
  );

  const agentAttributes = {
    "data-agent-surface": "cashpile-app",
    "data-agent-modules": showTaxModule
      ? "books,tax,cashflow,ai,settings"
      : "books,cashflow,ai,settings",
    "data-agent-capabilities-url": "/api/agent/capabilities",
    "data-agent-discovery-url": "/.well-known/cashpile-agent.json",
  };

  const useV2 = consumerEnabled || isUiV2Enabled();

  return (
    <ConsumerExperienceContext.Provider value={consumerEnabled}>
      <CashOverlayProvider consumerEnabled={consumerEnabled}>
      <div className={consumerEnabled ? "cashpile-consumer" : undefined}>
        {useV2 ? (
          <>
            <AppShellV2
              mode="app"
              theme={consumerEnabled ? "consumer" : "default"}
              navigation={navigation}
              pathname={pathname}
              mainProps={agentAttributes}
              menuExtra={consumerEnabled ? <SignOutButton /> : undefined}
            >
              {children}
            </AppShellV2>
            <Toaster richColors position="top-right" />
          </>
        ) : (
          <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar
              pinned={pinned}
              onPin={handlePin}
              mobileOpen={mobileOpen}
              onMobileClose={() => setMobileOpen(false)}
              showTaxModule={showTaxModule}
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
                data-agent-modules={
                  showTaxModule ? "books,tax,cashflow,ai,settings" : "books,cashflow,ai,settings"
                }
                data-agent-capabilities-url="/api/agent/capabilities"
                data-agent-discovery-url="/.well-known/cashpile-agent.json"
              >
                {children}
              </main>
            </div>

            <Toaster richColors position="top-right" />
          </div>
        )}
      </div>
      </CashOverlayProvider>
    </ConsumerExperienceContext.Provider>
  );
}

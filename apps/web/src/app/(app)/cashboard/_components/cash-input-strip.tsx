"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { useCashOverlay } from "../../_components/cash-overlay";

const CHIPS = [
  "Full financial snapshot",
  "Trades at risk today?",
  "What macro events matter this week?",
  "Compare cash flow to trading P&L",
];

export function CashInputStrip() {
  const { open } = useCashOverlay();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    open(value.trim() || undefined);
    setValue("");
  }

  return (
    <div className="w-full px-6 pb-8 pt-4">
      {/* Main input */}
      <form
        onSubmit={handleSubmit}
        className="relative max-w-2xl mx-auto"
      >
        <div className="flex items-center gap-0 rounded-2xl glass-card shadow-lg shadow-black/20 overflow-hidden ring-1 ring-transparent focus-within:ring-primary/40 transition-all">
          {/* Gradient orb */}
          <div className="pl-4 pr-3 py-3.5 shrink-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold">
              C
            </div>
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => { if (!value) open(); }}
            placeholder="Ask Cash anything about your finances…"
            className="flex-1 bg-transparent py-3.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <div className="pr-3 flex items-center gap-2 shrink-0">
            <kbd className="hidden sm:flex h-5 items-center gap-0.5 rounded border border-border/60 px-1.5 text-[10px] text-muted-foreground/70">
              <span className="text-[11px]">⌘</span>K
            </kbd>
            <button
              type="submit"
              className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
              aria-label="Ask Cash"
            >
              <ArrowRight className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </form>

      {/* Suggestion chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3 max-w-2xl mx-auto">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => open(chip)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground border border-border/60 rounded-full px-3 py-1 hover:border-primary/40 hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <Sparkles className="h-2.5 w-2.5 text-primary" />
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

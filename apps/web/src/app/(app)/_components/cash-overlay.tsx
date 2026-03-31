"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "ai/react";
import { Bot, X, Send, Loader2, BookOpen, TrendingUp, Activity, Sparkles } from "lucide-react";

// ─── Context ──────────────────────────────────────────────────────────────────

interface CashOverlayContextValue {
  open: (prefill?: string) => void;
  close: () => void;
  isOpen: boolean;
}

const CashOverlayContext = createContext<CashOverlayContextValue | null>(null);

export function useCashOverlay() {
  const ctx = useContext(CashOverlayContext);
  if (!ctx) throw new Error("useCashOverlay must be used inside CashOverlayProvider");
  return ctx;
}

// ─── Tool call display ───────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, { label: string; Icon: React.ElementType }> = {
  get_books_summary:          { label: "checking Books…",          Icon: BookOpen },
  get_books_uncategorized:    { label: "scanning uncategorized…",  Icon: BookOpen },
  bulk_categorize_transactions:{ label: "categorizing…",           Icon: BookOpen },
  suggest_transfers:          { label: "detecting transfers…",     Icon: BookOpen },
  get_books_export:           { label: "preparing export…",        Icon: BookOpen },
  get_trades_snapshot:        { label: "checking Trades…",         Icon: TrendingUp },
  get_pulse_events:           { label: "checking Pulse events…",   Icon: Activity },
  get_pulse_alerts:           { label: "checking Pulse alerts…",   Icon: Activity },
};

function ToolIndicator({ toolName }: { toolName: string }) {
  const info = TOOL_LABELS[toolName] ?? { label: "thinking…", Icon: Loader2 };
  const { Icon } = info;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-0.5">
      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      <Icon className="h-3 w-3 shrink-0" />
      Cash is {info.label}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  toolInvocations,
}: {
  role: "user" | "assistant";
  content: string;
  toolInvocations?: Array<{ toolName: string; state: string }>;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {toolInvocations?.map((t, i) =>
          t.state !== "result" ? <ToolIndicator key={i} toolName={t.toolName} /> : null
        )}
        {content && (
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "Give me a full financial snapshot",
  "Any trades at risk of breaching today?",
  "What macro events should I watch this week?",
  "How does my cash flow compare to my trading P&L?",
];

function CashOverlayModal({
  isOpen,
  prefill,
  onClose,
}: {
  isOpen: boolean;
  prefill: string;
  onClose: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, input, setInput, handleSubmit, status, setMessages } = useChat({
    api: "/api/ai/chat",
  });
  const isLoading = status === "streaming" || status === "submitted";

  // Pre-fill input when overlay opens with a prefill value
  useEffect(() => {
    if (isOpen && prefill) setInput(prefill);
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, prefill, setInput]);

  // Clear messages when closed
  useEffect(() => {
    if (!isOpen) setMessages([]);
  }, [isOpen, setMessages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-2xl h-[70vh] flex flex-col rounded-2xl glass-card shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
            C
          </div>
          <div>
            <div className="font-semibold text-sm">Cash</div>
            <div className="text-[11px] text-muted-foreground">Your AI financial intelligence</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] text-muted-foreground">
              esc
            </kbd>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                I have live access to your Books, Trades, and Pulse data. Ask anything.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-left text-xs border rounded-xl px-3.5 py-2.5 hover:border-primary/40 hover:bg-accent/40 transition-colors flex items-start gap-2 group"
                  >
                    <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  role={m.role as "user" | "assistant"}
                  content={m.content}
                  toolInvocations={
                    "toolInvocations" in m
                      ? (m.toolInvocations as Array<{ toolName: string; state: string }>)
                      : undefined
                  }
                />
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    C
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic pt-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t shrink-0">
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Cash anything…"
              disabled={isLoading}
              className="flex-1 h-10 rounded-xl border bg-muted/50 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-primary-foreground" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CashOverlayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState("");

  const open = useCallback((text?: string) => {
    setPrefill(text ?? "");
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPrefill("");
  }, []);

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? close() : open();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, open, close]);

  return (
    <CashOverlayContext.Provider value={{ open, close, isOpen }}>
      {children}
      <CashOverlayModal isOpen={isOpen} prefill={prefill} onClose={close} />
    </CashOverlayContext.Provider>
  );
}

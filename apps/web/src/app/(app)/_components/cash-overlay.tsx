"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "ai/react";
import { X, Send, Loader2, BookOpen, Sparkles, Zap, WalletCards } from "lucide-react";
import { TopupModal } from "@/components/ai/TopupModal";
import { isUiV2Enabled } from "@/components/ui-v2";

// ─── Context ──────────────────────────────────────────────────────────────────

interface CashOverlayContextValue {
  open: (prefill?: string, submitImmediately?: boolean) => void;
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
  get_books_summary:            { label: "checking Books…",         Icon: BookOpen },
  get_books_uncategorized:      { label: "scanning uncategorized…", Icon: BookOpen },
  bulk_categorize_transactions: { label: "categorizing…",           Icon: BookOpen },
  suggest_transfers:            { label: "detecting transfers…",    Icon: BookOpen },
  get_books_export:             { label: "preparing export…",       Icon: BookOpen },
  get_cashflow_snapshot:        { label: "checking cash flow…",     Icon: WalletCards },
  check_affordability:          { label: "checking affordability…", Icon: WalletCards },
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

// ─── Insufficient credits banner ──────────────────────────────────────────────

function InsufficientCreditsBanner({ onTopup }: { onTopup: () => void }) {
  const uiV2 = isUiV2Enabled();

  return (
    <div
      className="mx-5 mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3"
      role="alert"
    >
      <Zap className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${uiV2 ? "text-amber-900" : "text-amber-300"}`}>
          No AI credits remaining
        </p>
        <p className={`text-[11px] ${uiV2 ? "text-amber-950/75" : "text-muted-foreground"}`}>
          Top up to continue chatting with Cash.
        </p>
      </div>
      <button
        onClick={onTopup}
        className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-400 transition-colors"
        type="button"
      >
        Top up
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "Give me a full financial snapshot",
  "Can I afford $250 this week?",
  "What subscriptions am I paying for?",
  "Which transactions need reviewing?",
];

function CashOverlayModal({
  isOpen,
  prefill,
  submitImmediately,
  submitRequestId,
  onClose,
}: {
  isOpen: boolean;
  prefill: string;
  submitImmediately: boolean;
  submitRequestId: number;
  onClose: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const submittedRequestRef = useRef(0);
  const [noCredits, setNoCredits] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const uiV2 = isUiV2Enabled();

  const { messages, input, setInput, handleSubmit, status, setMessages, append } = useChat({
    api: "/api/ai/chat",
    onError: (error) => {
      if (error.message?.includes("402") || error.message?.includes("insufficient_credits")) {
        setNoCredits(true);
        setChatError("No AI credits remaining. Top up to continue chatting with Cash.");
        return;
      }
      setChatError("Cash could not complete that request. Please try again.");
    },
  });
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (isOpen && prefill && submitImmediately && submittedRequestRef.current !== submitRequestId) {
      submittedRequestRef.current = submitRequestId;
      setChatError(null);
      setInput("");
      append({ role: "user", content: prefill });
      return;
    }
    if (isOpen && prefill) setInput(prefill);
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [append, isOpen, prefill, setInput, submitImmediately, submitRequestId]);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setNoCredits(false);
      setChatError(null);
    }
  }, [isOpen, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior:
        uiV2 && window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
    });
  }, [messages, uiV2]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !uiV2) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    return () => previousFocusRef.current?.focus();
  }, [isOpen, uiV2]);

  useEffect(() => {
    if (!isOpen || !uiV2 || topupOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, [isOpen, topupOpen, uiV2]);

  if (!isOpen) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading || noCredits) return;
    setChatError(null);
    handleSubmit(e);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          ref={dialogRef}
          className={`relative w-full max-w-2xl flex flex-col rounded-2xl glass-card shadow-2xl shadow-black/40 overflow-hidden ${uiV2 ? "h-[70dvh] max-h-[720px]" : "h-[70vh]"}`}
          role={uiV2 ? "dialog" : undefined}
          aria-modal={uiV2 ? "true" : undefined}
          aria-labelledby={uiV2 ? "cash-overlay-title" : undefined}
          tabIndex={uiV2 ? -1 : undefined}
          data-agent-surface="cash-overlay"
          data-agent-primary-action="chat-with-cash"
          data-agent-tool-endpoint="/api/ai/chat"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
            <div>
              <div id="cash-overlay-title" className="font-semibold text-sm">Cash</div>
              <div className="text-[11px] text-muted-foreground">Your AI financial intelligence</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setTopupOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                title="Top up AI credits"
                aria-label="Top up AI credits"
                type="button"
              >
                <Zap className="h-3 w-3 text-primary" />
                Credits
              </button>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] text-muted-foreground">
                esc
              </kbd>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Close Cash"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Insufficient credits banner */}
          {noCredits && (
            <div className="pt-4 shrink-0">
              <InsufficientCreditsBanner onTopup={() => setTopupOpen(true)} />
            </div>
          )}

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
            aria-live={uiV2 ? "polite" : undefined}
            aria-busy={uiV2 ? isLoading : undefined}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  I can help you review transactions and understand your cash flow.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-left text-xs border rounded-xl px-3.5 py-2.5 hover:border-primary/40 hover:bg-accent/40 transition-colors flex items-start gap-2"
                      type="button"
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
                {chatError && (
                  <div
                    className="ml-9 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    role="alert"
                  >
                    {chatError}
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
                placeholder={noCredits ? "Top up to continue…" : "Ask Cash anything…"}
                aria-label="Ask Cash"
                disabled={isLoading || noCredits}
                className="flex-1 h-10 rounded-xl border bg-muted/50 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label="Send message to Cash"
                data-agent-action="send-overlay-message"
                disabled={!input.trim() || isLoading || noCredits}
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

      <TopupModal open={topupOpen} onOpenChange={setTopupOpen} />
    </>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CashOverlayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [submitImmediately, setSubmitImmediately] = useState(false);
  const [submitRequestId, setSubmitRequestId] = useState(0);

  const open = useCallback((text?: string, shouldSubmit = false) => {
    setPrefill(text ?? "");
    setSubmitImmediately(Boolean(text?.trim()) && shouldSubmit);
    if (text?.trim() && shouldSubmit) setSubmitRequestId((id) => id + 1);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPrefill("");
    setSubmitImmediately(false);
  }, []);

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
      <CashOverlayModal
        isOpen={isOpen}
        prefill={prefill}
        submitImmediately={submitImmediately}
        submitRequestId={submitRequestId}
        onClose={close}
      />
    </CashOverlayContext.Provider>
  );
}

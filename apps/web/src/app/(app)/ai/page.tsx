"use client";

import { useChat } from "ai/react";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, BookOpen, TrendingUp, Activity, Loader2 } from "lucide-react";
import { PageHeader } from "@cashpile/ui";

const SUGGESTED = [
  "How exposed is my portfolio to tomorrow's Fed announcement?",
  "What's my most profitable trading setup this month?",
  "How does my business cash flow compare to my trading P&L?",
  "Which instruments should I watch based on upcoming macro events?",
];

// Map tool names to readable loading labels
const TOOL_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  get_books_summary: { label: "checking Books…", icon: BookOpen },
  get_trades_snapshot: { label: "checking Trades…", icon: TrendingUp },
  get_pulse_events: { label: "checking Pulse events…", icon: Activity },
  get_pulse_alerts: { label: "checking Pulse alerts…", icon: Activity },
};

function ToolCallIndicator({ toolName }: { toolName: string }) {
  const info = TOOL_LABELS[toolName] ?? { label: "thinking…", icon: Loader2 };
  const Icon = info.icon;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      <Icon className="h-3 w-3" />
      Cash is {info.label}
    </div>
  );
}

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
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {/* Tool call states */}
        {toolInvocations?.map((t, i) =>
          t.state !== "result" ? (
            <ToolCallIndicator key={i} toolName={t.toolName} />
          ) : null
        )}
        {/* Text content */}
        {content && (
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, setInput, handleSubmit, status, error } = useChat({
    api: "/api/ai/chat",
  });

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setHasSubmitted(true);
    handleSubmit(e);
  }

  function useSuggestion(q: string) {
    setInput(q);
    setHasSubmitted(true);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <PageHeader
          title="AI Assistant"
          description="Ask anything about your finances across Books, Trades, and Pulse"
        />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {!hasSubmitted && messages.length === 0 ? (
          /* Empty state with suggestions */
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center mb-4">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Meet Cash</h3>
            <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto text-center">
              I have live access to your Books, Trades, and Pulse data simultaneously. Ask anything about your full financial picture.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => useSuggestion(q)}
                  className="text-left text-sm bg-background border rounded-xl p-3.5 hover:border-primary/40 hover:bg-accent/50 transition-colors flex items-start gap-2.5 group"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0 group-hover:text-primary" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
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

            {/* Global loading indicator when no partial text yet */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  C
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic pt-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                Something went wrong. Please try again.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t bg-background p-4 shrink-0">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your finances…"
                disabled={isLoading}
                className="w-full h-11 rounded-xl border bg-background px-4 pr-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-primary-foreground" />
                )}
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Cash has live access to your Books, Trades, and Pulse data.
          </p>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@cashpile/ui";

const SUGGESTED = [
  "How exposed is my portfolio to tomorrow's Fed announcement?",
  "What's my most profitable trading setup this month?",
  "How does my business cash flow compare to my trading P&L?",
  "Which instruments should I watch based on upcoming macro events?",
];

export default function AIPage() {
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col h-screen">
      <div className="p-6 border-b">
        <PageHeader title="AI Assistant" description="Ask anything about your finances across Books, Trades, and Pulse" />
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Cashpile AI</h3>
          <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
            I can see your Books, Trades, and Pulse data simultaneously. Ask anything about your full financial picture.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {SUGGESTED.map((q) => (
              <button key={q} onClick={() => setInput(q)} className="text-left text-sm bg-background border rounded-lg p-3 hover:border-primary/40 transition-colors flex items-start gap-2">
                <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t p-4">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              className="w-full h-11 rounded-xl border bg-background px-4 pr-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

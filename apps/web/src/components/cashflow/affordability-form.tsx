"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { AffordabilityResult } from "@cashpile/ai";

function parseAmount(text: string) {
  const match = text.replace(/,/g, "").match(/\$?([0-9]+(?:\.[0-9]{1,2})?)/);
  return match ? Number(match[1]) : NaN;
}

function statusLabel(status: AffordabilityResult["status"]) {
  if (status === "yes") return { text: "Yes", cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
  if (status === "caution") return { text: "Caution", cls: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" };
  return { text: "No", cls: "text-red-500 bg-red-500/10 border-red-500/20" };
}

export function AffordabilityForm({ variant = "full" }: { variant?: "full" | "compact" }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = parseAmount(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Include a dollar amount, e.g. '$250 dinner this weekend'.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cashflow/affordability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: input, horizonDays: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not check affordability");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check affordability");
    } finally {
      setLoading(false);
    }
  }

  const label = result ? statusLabel(result.status) : null;

  const isCompact = variant === "compact";

  return (
    <div className={isCompact ? "space-y-3" : "space-y-4"}>
      <form onSubmit={submit} className={isCompact ? "space-y-3" : "glass-card rounded-2xl p-4"}>
        <label className="text-sm font-medium">Can I afford it?</label>
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="$250 dinner this weekend"
            className={isCompact ? "flex-1 h-10 rounded-xl border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "flex-1 h-12 rounded-xl border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={isCompact ? "h-10 px-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2" : "h-12 px-4 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Check
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {["$900 trip next month", "$500 extra debt payment", "$700 transfer to savings"].map((text) => (
            <button key={text} type="button" onClick={() => setInput(text)} className="rounded-full border px-3 py-1 text-muted-foreground hover:text-foreground hover:bg-accent">
              {text}
            </button>
          ))}
        </div>
      </form>

      {result && label && (
        <div className={isCompact ? "rounded-2xl border bg-background/50 p-4 space-y-3" : "glass-card rounded-2xl p-5 space-y-4"}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${label.cls}`}>{label.text}</span>
              <h2 className={isCompact ? "mt-2 text-sm font-semibold line-clamp-1" : "mt-3 text-xl font-semibold"}>{result.description || "Planned purchase"}</h2>
              <p className="text-sm text-muted-foreground">Purchase amount: {formatCurrency(result.requestedAmount)}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Safe after purchase</div>
              <div className={`${isCompact ? "text-xl" : "text-2xl"} font-bold font-mono ${result.safeToSpendAfterPurchase >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatCurrency(result.safeToSpendAfterPurchase)}
              </div>
            </div>
          </div>

          <div className={isCompact ? "grid grid-cols-2 gap-2" : "grid sm:grid-cols-4 gap-3"}>
            <Metric label="Safe before" value={formatCurrency(result.safeToSpendBeforePurchase)} />
            <Metric label="Current spendable" value={formatCurrency(result.currentSpendableBalance)} />
            <Metric label="Projected low" value={formatCurrency(result.projectedLowBalanceAfterPurchase)} />
            <Metric label="Buffer" value={formatCurrency(result.minimumBuffer)} />
          </div>

          {isCompact ? (
            <p className="text-xs text-muted-foreground">{result.keyReasons[1] ?? result.keyReasons[0]}</p>
          ) : (
            <div>
              <h3 className="text-sm font-semibold mb-2">Why</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                {result.keyReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          )}

          {!isCompact && result.blockingObligations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Upcoming obligations</h3>
              <div className="space-y-2">
                {result.blockingObligations.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2 text-sm">
                    <span className="truncate">{item.label}</span>
                    <span className="font-mono text-red-500">{item.date} · {formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/50 p-3 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold tabular-nums">{value}</div>
    </div>
  );
}

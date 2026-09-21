"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Info } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { AffordabilityResult } from "@cashpile/ai";

interface Props {
  reserves: Array<{ id: string; name: string; isEmergency: boolean }>;
  today: string;
}

type ScenarioType = "purchase" | "savings_transfer";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function WhatIfClient({ reserves, today }: Props) {
  const [scenarioType, setScenarioType] = useState<ScenarioType>("purchase");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [label, setLabel] = useState("");
  const [reserveAccountId, setReserveAccountId] = useState(reserves.find((r) => r.isEmergency)?.id ?? reserves[0]?.id ?? "");
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function preview() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    if (scenarioType === "savings_transfer" && !reserveAccountId) {
      toast.error("Choose which emergency reserve receives the transfer");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/cashflow/affordability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          date,
          description: label.trim() || undefined,
          scenarioType,
          reserveAccountId: scenarioType === "savings_transfer" ? reserveAccountId : undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body?.error ?? "Preview failed");
        return;
      }
      setResult(body as AffordabilityResult);
    } catch {
      toast.error("Preview failed — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Scenario type</legend>
          {([
            { value: "purchase", title: "One-time purchase", hint: "Spending cash goes down; your emergency reserve is untouched." },
            { value: "savings_transfer", title: "Transfer to savings", hint: "Spending cash goes down; the chosen reserve goes up." },
          ] as const).map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-3 ${scenarioType === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
            >
              <input
                type="radio"
                name="scenarioType"
                value={option.value}
                checked={scenarioType === option.value}
                onChange={() => setScenarioType(option.value)}
                className="sr-only"
              />
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{option.hint}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground space-y-1">
            Amount ($)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 700"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            Date
            <input
              type="date"
              value={date}
              min={today}
              max={addDays(today, 90)}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            Label (optional)
            <input
              type="text"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. new tires"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        {scenarioType === "savings_transfer" && (
          <div className="space-y-1">
            {reserves.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No savings reserve in your plan yet. Mark an account as a reserve first — the transfer needs a destination.
              </p>
            ) : (
              <label className="text-xs text-muted-foreground space-y-1 block">
                Transfer into
                <select
                  value={reserveAccountId}
                  onChange={(e) => setReserveAccountId(e.target.value)}
                  className="w-full sm:w-72 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {reserves.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}{r.isEmergency ? " (emergency fund)" : ""}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={preview}
            disabled={loading || (scenarioType === "savings_transfer" && reserves.length === 0)}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Calculating…" : "Preview"}
          </button>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5" /> Read-only preview — no money moves, nothing is committed.
          </span>
        </div>
      </section>

      {result && (
        <section className="glass-card rounded-2xl p-5 space-y-4" aria-live="polite">
          <h2 className="text-sm font-semibold">
            {result.scenario?.type === "savings_transfer" ? "Transfer" : "Purchase"} of {formatCurrency(result.requestedAmount)} on {result.purchaseDate}
            {result.description ? ` — ${result.description}` : ""}
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <ResultChange
              title="Available to spend"
              before={result.availableUntilPaydayBefore}
              after={result.availableUntilPaydayAfter}
            />
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Projected 30-day low</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-sm">
                <span>{formatCurrency(result.projectedLowBalanceBeforePurchase ?? 0)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={result.cashRiskAfter?.shortfall ? "text-red-600" : ""}>
                  {formatCurrency(result.projectedLowBalanceAfterPurchase)}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                low point {result.cashRiskAfter?.lowDate}
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Emergency cushion</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-sm">
                <span>{monthsLabel(result.emergencyCushionBefore?.months)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-emerald-600">{monthsLabel(result.emergencyCushionAfter?.months)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {result.scenario?.type === "purchase"
                  ? "unchanged — purchases never consume your reserve"
                  : "reserve grows by the transfer amount"}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">What changes and why</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {result.keyReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>

          {result.dataQuality && result.dataQuality.missingInputs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Missing inputs in this estimate</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800">
                {result.dataQuality.missingInputs.map((input) => (
                  <li key={input}>
                    {input === "essential_allowance" && "Everyday spending allowance is not set, so essentials like groceries are missing from this forecast."}
                    {input === "confirmed_payday" && "No payday confirmed — the 14-day estimate is used."}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.cashRiskAfter && result.cashRiskAfter.shortfall > 0 && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              This change leaves a projected shortfall of {formatCurrency(result.cashRiskAfter.shortfall)} on{" "}
              {result.cashRiskAfter.firstNegativeDate ?? result.cashRiskAfter.lowDate}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function ResultChange({ title, before, after }: { title: string; before: number | null | undefined; after: number | null | undefined }) {
  const fmt = (v: number | null | undefined) => (v == null ? "—" : formatCurrency(v));
  const worse = before != null && after != null && after < before;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-center gap-2 font-mono text-sm">
        <span>{fmt(before)}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={worse ? "text-red-600" : "text-foreground"}>{fmt(after)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">before payday</div>
    </div>
  );
}

function monthsLabel(months: number | null | undefined): string {
  if (months == null) return "unknown";
  return `${months.toFixed(1)} mo`;
}
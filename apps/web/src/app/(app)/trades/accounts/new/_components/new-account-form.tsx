"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createPropAccount } from "@/modules/trades/actions/account.actions";
import type { AccountStatus } from "@/modules/trades/types";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: "evaluation", label: "Evaluation" },
  { value: "funded", label: "Funded" },
  { value: "inactive", label: "Inactive" },
];

export default function NewAccountForm() {
  const router = useRouter();
  const [firmName, setFirmName] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [maxDailyDrawdownPct, setMaxDailyDrawdownPct] = useState("5");
  const [maxTotalDrawdownPct, setMaxTotalDrawdownPct] = useState("10");
  const [profitTargetPct, setProfitTargetPct] = useState("10");
  const [trailingDrawdown, setTrailingDrawdown] = useState(false);
  const [status, setStatus] = useState<AccountStatus>("evaluation");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firmName || !accountSize) {
      setError("Firm name and account size are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const size = parseFloat(accountSize);
      await createPropAccount({
        firmName,
        accountLabel: accountLabel || undefined,
        accountSize: size,
        startingBalance: size,
        currency,
        maxDailyDrawdownPct: parseFloat(maxDailyDrawdownPct),
        maxTotalDrawdownPct: parseFloat(maxTotalDrawdownPct),
        profitTargetPct: profitTargetPct ? parseFloat(profitTargetPct) : undefined,
        trailingDrawdown,
        status,
        notes: notes || undefined,
      });
      router.push("/trades/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Prop Account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add a funded or evaluation account to start tracking rules and performance.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="space-y-3 border rounded-lg p-4">
          <legend className="text-sm font-medium px-1">Account Info</legend>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prop Firm Name</label>
            <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="FTMO, TopStep, Apex…" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Account Label (optional)</label>
            <Input value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} placeholder="100K Challenge #2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Account Size</label>
              <Input type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} placeholder="100000" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as AccountStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <fieldset className="space-y-3 border rounded-lg p-4">
          <legend className="text-sm font-medium px-1">Funded Rules</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Daily Loss %</label>
              <Input type="number" step="0.1" value={maxDailyDrawdownPct} onChange={(e) => setMaxDailyDrawdownPct(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Total Drawdown %</label>
              <Input type="number" step="0.1" value={maxTotalDrawdownPct} onChange={(e) => setMaxTotalDrawdownPct(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Profit Target % (optional)</label>
            <Input type="number" step="0.1" value={profitTargetPct} onChange={(e) => setProfitTargetPct(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={trailingDrawdown}
              onChange={(e) => setTrailingDrawdown(e.target.checked)}
            />
            Trailing drawdown (EOD high-water mark)
          </label>
        </fieldset>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
            placeholder="Challenge phase, special rules…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Account"}</Button>
        </div>
      </form>
    </div>
  );
}

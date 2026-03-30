"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createTrade } from "@/modules/trades/actions/trade.actions";
import type { TradesPropAccount, TradeDirection } from "@/modules/trades/types";

interface Props { accounts: TradesPropAccount[] }

function localDateTimeNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewTradeForm({ accounts }: Props) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [instrument, setInstrument] = useState("");
  const [direction, setDirection] = useState<TradeDirection>("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [size, setSize] = useState("");
  const [entryTime, setEntryTime] = useState(localDateTimeNow());
  const [initialStop, setInitialStop] = useState("");
  const [commissions, setCommissions] = useState("0");
  const [setupTag, setSetupTag] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !instrument || !entryPrice || !size) {
      setError("Account, instrument, entry price, and size are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createTrade({
        accountId,
        instrument: instrument.toUpperCase(),
        direction,
        entryPrice: parseFloat(entryPrice),
        size: parseFloat(size),
        entryTime: new Date(entryTime).toISOString(),
        initialStop: initialStop ? parseFloat(initialStop) : undefined,
        commissions: commissions ? parseFloat(commissions) : 0,
        setupTag: setupTag || undefined,
        notes: notes || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      router.push("/trades/journal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trade");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Log Trade</h1>
        <p className="text-muted-foreground text-sm mt-1">Record a new trade entry into your journal.</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Account</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firm_name}{a.account_label ? ` — ${a.account_label}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Instrument</label>
            <Input
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="ES, NQ, EUR/USD…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Direction</label>
            <Select value={direction} onValueChange={(v) => setDirection(v as TradeDirection)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Entry Price</label>
            <Input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Size / Contracts</label>
            <Input
              type="number"
              step="any"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Initial Stop</label>
            <Input
              type="number"
              step="any"
              value={initialStop}
              onChange={(e) => setInitialStop(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Commissions</label>
            <Input
              type="number"
              step="any"
              value={commissions}
              onChange={(e) => setCommissions(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Entry Time</label>
          <Input
            type="datetime-local"
            value={entryTime}
            onChange={(e) => setEntryTime(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Setup Tag</label>
          <Input
            value={setupTag}
            onChange={(e) => setSetupTag(e.target.value)}
            placeholder="e.g., Break & Retest, VWAP Bounce…"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="reversal, morning-session…"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
            placeholder="Trade rationale, what you saw…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Log Trade"}
          </Button>
        </div>
      </form>
    </div>
  );
}

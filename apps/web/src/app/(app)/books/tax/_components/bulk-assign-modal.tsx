"use client";

import { useState } from "react";
import type { TaxEntity } from "@/modules/books/types";

interface Props {
  taxEntities: TaxEntity[];
  onClose: () => void;
}

export function BulkAssignModal({ taxEntities, onClose }: Props) {
  const [taxEntityId, setTaxEntityId] = useState(taxEntities[0]?.id ?? "");
  const [businessPct, setBusinessPct] = useState(100);
  const [deductionPct, setDeductionPct] = useState(100);
  const [isDeductible, setIsDeductible] = useState(false);
  const [notes, setNotes] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ assigned: number; skipped: number } | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setProgress(null);
    setResult(null);

    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const txRes = await fetch(`/api/books/transactions?${params}`);
    const txData = txRes.ok ? await txRes.json() : { transactions: [] };
    const txIds: string[] = (txData.transactions ?? []).map((t: any) => t.id);

    if (!txIds.length) {
      setSaving(false);
      setResult({ assigned: 0, skipped: 0 });
      return;
    }

    const batchSize = 100;
    let totalAssigned = 0;
    let totalSkipped = 0;
    setProgress({ done: 0, total: txIds.length });

    for (let i = 0; i < txIds.length; i += batchSize) {
      const batch = txIds.slice(i, i + batchSize);
      const res = await fetch("/api/tax/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: batch,
          taxEntityId,
          businessPct,
          deductionPct,
          isDeductible,
          notes,
        }),
      });
      if (res.ok) {
        const r = await res.json();
        totalAssigned += r.assigned ?? 0;
        totalSkipped += r.skipped ?? 0;
      }
      setProgress({ done: Math.min(i + batchSize, txIds.length), total: txIds.length });
    }

    setSaving(false);
    setResult({ assigned: totalAssigned, skipped: totalSkipped });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="font-semibold">Bulk Assign Transactions</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Tax Entity</span>
            <select
              value={taxEntityId}
              onChange={e => setTaxEntityId(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
            >
              {taxEntities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Date To</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground"><span>Business Use %</span><span>{businessPct}%</span></div>
              <input
                type="range"
                min={0}
                max={100}
                value={businessPct}
                onChange={e => setBusinessPct(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground"><span>Deduction %</span><span>{deductionPct}%</span></div>
              <input
                type="range"
                min={0}
                max={100}
                value={deductionPct}
                onChange={e => setDeductionPct(Number(e.target.value))}
                className="w-full"
              />
            </label>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDeductible}
                onChange={e => setIsDeductible(e.target.checked)}
              />
              <span>Tax Deductible</span>
            </label>
            <input
              placeholder="Notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="flex-1 bg-background border border-border rounded-md px-3 py-1 text-sm"
            />
          </div>

          {progress && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">{progress.done} / {progress.total}</div>
            </div>
          )}

          {result && (
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
              Done — <span className="text-foreground font-medium">{result.assigned} assigned</span>, {result.skipped} skipped
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm border border-border hover:bg-muted/30"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleSubmit}
              disabled={saving || !taxEntityId}
              className="px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Processing..." : "Bulk Assign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

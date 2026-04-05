"use client";

import { useState, useEffect, useCallback } from "react";

type Uda = { id: string; name: string };
type Transaction = {
  id: string;
  description: string | null;
  merchant: string | null;
  amount: number;
  date: string;
  type: string;
};

interface Props {
  uda: Uda;
  year: number;
  onClose: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(n));
}

export function AssignModal({ uda, year, onClose }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [businessPct, setBusinessPct] = useState(100);
  const [deductionPct, setDeductionPct] = useState(100);
  const [isDeductible, setIsDeductible] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, reportRes] = await Promise.all([
        fetch(`/api/books/transactions?dateFrom=${year}-01-01&dateTo=${year}-12-31`),
        fetch(`/api/tax/report?udaId=${uda.id}&year=${year}`),
      ]);
      const txData = txRes.ok ? await txRes.json() : { transactions: [] };
      const reportData = reportRes.ok ? await reportRes.json() : { transactions: [] };
      const assigned = new Set<string>((reportData.transactions ?? []).map((v: any) => v.transaction_id as string));
      setAssignedIds(assigned);
      setTransactions(txData.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, [uda.id, year]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    if (assignedIds.has(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selected.size) return;
    setSaving(true);
    await fetch("/api/tax/assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionIds: Array.from(selected),
        udaId: uda.id,
        businessPct,
        deductionPct,
        isDeductible,
        notes,
      }),
    });
    setSaving(false);
    onClose();
  };

  const filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    return !q || (t.description ?? "").toLowerCase().includes(q) || (t.merchant ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-semibold">Assign Transactions</div>
            <div className="text-xs text-muted-foreground">{uda.name} · {year}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 border-b border-border space-y-3">
          <input
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground"><span>Business Use %</span><span>{businessPct}%</span></div>
              <input type="range" min={0} max={100} value={businessPct} onChange={e => setBusinessPct(Number(e.target.value))} className="w-full" />
            </label>
            <label className="text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground"><span>Deduction %</span><span>{deductionPct}%</span></div>
              <input type="range" min={0} max={100} value={deductionPct} onChange={e => setDeductionPct(Number(e.target.value))} className="w-full" />
            </label>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isDeductible} onChange={e => setIsDeductible(e.target.checked)} />
              <span>Tax Deductible</span>
            </label>
            <input
              placeholder="Notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="flex-1 bg-background border border-border rounded-md px-3 py-1 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No transactions found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="w-8 p-2"></th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Description</th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const isAssigned = assignedIds.has(t.id);
                  const isSelected = selected.has(t.id);
                  return (
                    <tr key={t.id} onClick={() => toggle(t.id)} className={`border-b border-border/50 cursor-pointer hover:bg-muted/20 ${isAssigned ? "opacity-50" : ""}`}>
                      <td className="p-2 text-center">
                        {isAssigned ? <span className="text-green-500">✓</span> : <input type="checkbox" checked={isSelected} readOnly />}
                      </td>
                      <td className="p-2 text-muted-foreground">{t.date}</td>
                      <td className="p-2">{t.merchant || t.description || "—"}</td>
                      <td className={`p-2 text-right ${t.amount < 0 ? "text-red-400" : "text-green-500"}`}>
                        {t.amount < 0 ? "-" : "+"}{fmt(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{selected.size} selected</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-md text-sm border border-border hover:bg-muted/30">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!selected.size || saving}
              className="px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : `Assign ${selected.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AssignModal } from "./assign-modal";
import { BulkAssignModal } from "./bulk-assign-modal";
import { ExportPanel } from "./export-panel";

type Uda = { id: string; name: string; description: string | null };
type Summary = { totalIncome: number; totalExpenses: number; transactionCount: number };

interface Props {
  udas: Uda[];
  summaries: Record<string, Summary>;
  defaultYear: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function TaxClient({ udas, summaries, defaultYear }: Props) {
  const [year, setYear] = useState(defaultYear);
  const [assignUda, setAssignUda] = useState<Uda | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exportUda, setExportUda] = useState<Uda | null>(null);

  const years = Array.from({ length: 6 }, (_, i) => defaultYear - i);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign transactions to entities for tax reporting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => setBulkOpen(true)}
            className="bg-secondary text-secondary-foreground px-4 py-1.5 rounded-md text-sm hover:bg-secondary/80"
          >
            Bulk Assign
          </button>
        </div>
      </div>

      {udas.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          No entities (UDAs) found. Create one in Accounts first.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {udas.map((uda) => {
          const s = summaries[uda.id] ?? { totalIncome: 0, totalExpenses: 0, transactionCount: 0 };
          const net = s.totalIncome - s.totalExpenses;
          return (
            <div key={uda.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <div className="font-semibold text-base">{uda.name}</div>
                {uda.description && (
                  <div className="text-muted-foreground text-xs mt-0.5">{uda.description}</div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Income</div>
                  <div className="font-medium text-green-500">{fmt(s.totalIncome)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Expenses</div>
                  <div className="font-medium text-red-400">{fmt(s.totalExpenses)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Net</div>
                  <div className={`font-medium ${net >= 0 ? "text-green-500" : "text-red-400"}`}>
                    {fmt(net)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {s.transactionCount} transactions assigned
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setAssignUda(uda)}
                  className="flex-1 bg-primary text-primary-foreground rounded-md py-1.5 text-xs font-medium hover:bg-primary/90"
                >
                  Assign Transactions
                </button>
                <button
                  onClick={() => setExportUda(uda)}
                  className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-xs hover:bg-secondary/80"
                >
                  Export
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {assignUda && (
        <AssignModal uda={assignUda} year={year} onClose={() => setAssignUda(null)} />
      )}
      {bulkOpen && (
        <BulkAssignModal udas={udas} onClose={() => setBulkOpen(false)} />
      )}
      {exportUda && (
        <ExportPanel uda={exportUda} year={year} onClose={() => setExportUda(null)} />
      )}
    </div>
  );
}

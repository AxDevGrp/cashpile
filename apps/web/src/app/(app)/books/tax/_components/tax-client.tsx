"use client";

import { useState } from "react";
import { Badge } from "@cashpile/ui";
import { AssignModal } from "./assign-modal";
import { BulkAssignModal } from "./bulk-assign-modal";
import { ExportPanel } from "./export-panel";
import type { TaxEntity } from "@/modules/books/types";

type Summary = { totalIncome: number; totalExpenses: number; transactionCount: number };

interface Props {
  taxEntities: TaxEntity[];
  summaries: Record<string, Summary>;
  defaultYear: number;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  llc: "LLC",
  s_corp: "S-Corp",
  c_corp: "C-Corp",
  partnership: "Partnership",
  sole_proprietorship: "Sole Prop",
  rental_property: "Rental",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function TaxClient({ taxEntities, summaries, defaultYear }: Props) {
  const [year, setYear] = useState(defaultYear);
  const [assignEntity, setAssignEntity] = useState<TaxEntity | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exportEntity, setExportEntity] = useState<TaxEntity | null>(null);

  const years = Array.from({ length: 6 }, (_, i) => defaultYear - i);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Entities</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign transactions to Tax Entities for tax reporting
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

      {taxEntities.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-4">No Tax Entities found.</p>
          <p className="text-sm">Create a Tax Entity in Settings to start tracking business expenses.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {taxEntities.map((entity) => {
          const s = summaries[entity.id] ?? { totalIncome: 0, totalExpenses: 0, transactionCount: 0 };
          const net = s.totalIncome - s.totalExpenses;
          return (
            <div key={entity.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-base">{entity.name}</div>
                  <Badge variant="secondary" className="text-xs">
                    {ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}
                  </Badge>
                </div>
                {entity.tax_id && (
                  <div className="text-muted-foreground text-xs mt-0.5">Tax ID: {entity.tax_id}</div>
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
                  onClick={() => setAssignEntity(entity)}
                  className="flex-1 bg-primary text-primary-foreground rounded-md py-1.5 text-xs font-medium hover:bg-primary/90"
                >
                  Assign Transactions
                </button>
                <button
                  onClick={() => setExportEntity(entity)}
                  className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-xs hover:bg-secondary/80"
                >
                  Export
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {assignEntity && (
        <AssignModal taxEntity={assignEntity} year={year} onClose={() => setAssignEntity(null)} />
      )}
      {bulkOpen && (
        <BulkAssignModal taxEntities={taxEntities} onClose={() => setBulkOpen(false)} />
      )}
      {exportEntity && (
        <ExportPanel taxEntity={exportEntity} year={year} onClose={() => setExportEntity(null)} />
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@cashpile/ui";
import { assignAccountToTaxEntity } from "@/modules/books/actions/account.actions";
import type { BooksAccount, TaxEntity } from "@/modules/books/types";

interface Props {
  taxEntity: TaxEntity;
  taxEntities: TaxEntity[];
  accounts: BooksAccount[];
  onClose: () => void;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  investment: "Investment",
  other: "Other",
};

export function AccountAssignmentModal({ taxEntity, taxEntities, accounts, onClose }: Props) {
  const router = useRouter();
  const initialSelected = useMemo(
    () => new Set(accounts.filter((account) => account.tax_entity_id === taxEntity.id).map((account) => account.id)),
    [accounts, taxEntity.id]
  );
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ assigned: number; unassigned: number; assignedTransactions: number; unassignedTransactions: number } | null>(null);

  function toggle(accountId: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(accountId) ? next.delete(accountId) : next.add(accountId);
      return next;
    });
  }

  async function handleSave() {
    const toAssign = accounts.filter((account) => selected.has(account.id) && account.tax_entity_id !== taxEntity.id);
    const toUnassign = accounts.filter((account) => !selected.has(account.id) && account.tax_entity_id === taxEntity.id);
    const changes = [...toAssign, ...toUnassign];

    if (changes.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setProgress({ done: 0, total: changes.length });

    let done = 0;
    let assignedTransactions = 0;
    let unassignedTransactions = 0;
    try {
      for (const account of toAssign) {
        const updated = await assignAccountToTaxEntity(account.id, taxEntity.id);
        assignedTransactions += updated.assigned_transaction_count ?? 0;
        done++;
        setProgress({ done, total: changes.length });
      }
      for (const account of toUnassign) {
        const updated = await assignAccountToTaxEntity(account.id, null);
        unassignedTransactions += updated.unassigned_transaction_count ?? 0;
        done++;
        setProgress({ done, total: changes.length });
      }

      setResult({ assigned: toAssign.length, unassigned: toUnassign.length, assignedTransactions, unassignedTransactions });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-semibold">Assign Accounts to Tax Entity</div>
            <div className="text-xs text-muted-foreground">
              {taxEntity.name} · selected accounts will auto-assign all their transactions
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-4 border-b border-border text-sm text-muted-foreground">
          Select accounts like Amex Blue or Amex Plum. Existing and future transactions in selected accounts will be assigned to {taxEntity.name}.
        </div>

        <div className="flex-1 overflow-auto">
          {accounts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No accounts found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="w-10 p-3"></th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Account</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Type</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Current Tax Entity</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const checked = selected.has(account.id);
                  const assignedEntity = taxEntities.find((entity) => entity.id === account.tax_entity_id);
                  return (
                    <tr
                      key={account.id}
                      onClick={() => toggle(account.id)}
                      className={`border-b border-border/50 cursor-pointer hover:bg-muted/20 ${checked ? "bg-primary/5" : ""}`}
                    >
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={checked} readOnly />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{account.name}</div>
                        <div className="text-xs text-muted-foreground">{account.institution_name ?? account.institution ?? "—"}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {assignedEntity ? assignedEntity.name : "Unassigned"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {account.current_balance == null
                          ? "—"
                          : Number(account.current_balance).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3">
          {progress && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">{progress.done} / {progress.total} account updates complete</div>
            </div>
          )}
          {result && (
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
              Done — <span className="text-foreground font-medium">{result.assigned} account{result.assigned === 1 ? "" : "s"} assigned</span>, {result.unassigned} unassigned. {result.assignedTransactions} transaction{result.assignedTransactions === 1 ? "" : "s"} populated into this Tax Entity.
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">{selected.size} account{selected.size === 1 ? "" : "s"} selected</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
              {!result && <Button onClick={handleSave} disabled={saving}>{saving ? "Assigning…" : "Save Account Assignments"}</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

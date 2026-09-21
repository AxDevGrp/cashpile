"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, X } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { RecurringCadence, RecurringItem } from "@cashpile/ai";
import { addManualRecurringItem, saveRecurringCorrection, setRecurringExcluded } from "../actions";

const CADENCE_OPTIONS: RecurringCadence[] = ["weekly", "biweekly", "monthly", "quarterly", "annual"];

interface Props {
  items: RecurringItem[];
}

export default function RecurringReviewClient({ items }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCadence, setEditCadence] = useState<RecurringCadence>("monthly");
  const [editNextDate, setEditNextDate] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState("");

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function startEdit(item: RecurringItem) {
    setEditingId(item.id);
    setEditAmount(String(item.averageAmount));
    setEditCadence(item.cadence === "irregular" ? "monthly" : item.cadence);
    setEditNextDate(item.nextExpectedDate);
  }

  function saveEdit(item: RecurringItem) {
    run(async () => {
      await saveRecurringCorrection({
        id: item.confirmed ? item.id : undefined,
        proposal: item.confirmed ? undefined : item,
        amount: Number(editAmount),
        cadence: editCadence,
        nextDate: editNextDate,
      });
      setEditingId(null);
      toast.success("Correction saved");
    });
  }

  function toggleIncluded(item: RecurringItem, excluded: boolean) {
    run(async () => {
      await setRecurringExcluded({
        id: item.confirmed || item.source === "manual" ? item.id : undefined,
        proposal: item.confirmed || item.source === "manual" ? undefined : item,
        excluded,
      });
      toast.success(excluded ? "Marked as not recurring" : "Included in your forecast");
    });
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border/40">
        <p className="text-sm text-muted-foreground">
          Confirm what Cashpile detected, correct anything that looks wrong, or add a missing bill or payday.
          Corrections survive refreshes and re-syncs.
        </p>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <Plus className="h-4 w-4" /> Add missing item
        </button>
      </div>

      {showAdd && (
        <form
          className="p-4 grid gap-3 border-b border-border/40 bg-muted/30 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            run(async () => {
              await addManualRecurringItem({
                direction: form.get("direction") === "income" ? "income" : "expense",
                merchant: String(form.get("merchant") ?? ""),
                amount: Number(form.get("amount")),
                cadence: String(form.get("cadence")) as RecurringCadence,
                nextDate: String(form.get("nextDate") ?? ""),
              });
              setShowAdd(false);
              setAddError("");
              toast.success("Added to your recurring items");
            });
          }}
        >
          <select name="direction" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue="expense" onChange={() => setAddError("")}>
            <option value="expense">Bill / expense</option>
            <option value="income">Payday / income</option>
          </select>
          <input name="merchant" required maxLength={100} placeholder="Name (e.g. Rent)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select name="cadence" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue="monthly">
            {CADENCE_OPTIONS.map((c) => (
              <option key={c} value={c}>{c.replace("_", " ")}</option>
            ))}
          </select>
          <input name="nextDate" required type="date" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Add
          </button>
          {addError && <p className="text-xs text-red-500 sm:col-span-2 lg:col-span-6">{addError}</p>}
        </form>
      )}

      {items.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No recurring items yet. More transaction history will improve detection, or add a missing bill or payday above.
        </p>
      ) : (
        <div className="divide-y">
          {items.map((item) => {
            const excluded = item.included === false;
            const editable = editingId === item.id;
            return (
              <div key={item.id} className={`p-4 space-y-3 ${excluded ? "opacity-60" : ""}`}>
                <div className="grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {item.merchant}
                      {item.source === "manual" && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">Added by you</span>}
                      {excluded && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Not recurring</span>}
                      {item.confirmed && !excluded && item.source !== "manual" && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">Confirmed</span>}
                      {item.flowKind === "internal_transfer" && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Transfer</span>}
                      {item.flowKind === "card_payment" && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Card payment</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.cadence.replace("_", " ")} · next expected {item.nextExpectedDate}</div>
                  </div>
                  <div className={`font-mono text-sm ${item.direction === "income" ? "text-emerald-500" : "text-red-500"}`}>
                    {item.direction === "income" ? "+" : "-"}{formatCurrency(item.averageAmount)}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{item.direction === "income" ? "income" : "bill"}</div>
                  <div className="text-xs text-muted-foreground">{item.confirmed || item.source === "manual" ? "You confirmed this" : `${Math.round(item.confidence * 100)}% confidence`}</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => (editable ? saveEdit(item) : startEdit(item))}
                      disabled={excluded}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                      title="Edit amount, cadence, or next date"
                    >
                      {editable ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                      {editable ? "Save" : "Edit"}
                    </button>
                    {!item.confirmed && item.source !== "manual" && !excluded && (
                      <button
                        onClick={() => toggleIncluded(item, false)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        title="Confirm this is accurate"
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm
                      </button>
                    )}
                    <button
                      onClick={() => toggleIncluded(item, !excluded)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                      title={excluded ? "Include this in your forecast again" : "This is not recurring"}
                    >
                      {excluded ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {excluded ? "Include" : "Not recurring"}
                    </button>
                  </div>
                </div>

                {editable && (
                  <div className="grid gap-2 sm:grid-cols-4 rounded-xl border border-border bg-muted/30 p-3">
                    <label className="text-xs text-muted-foreground space-y-1">
                      Amount
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground space-y-1">
                      How often
                      <select
                        value={editCadence}
                        onChange={(e) => setEditCadence(e.target.value as RecurringCadence)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      >
                        {CADENCE_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c.replace("_", " ")}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground space-y-1">
                      Next date
                      <input
                        type="date"
                        value={editNextDate}
                        onChange={(e) => setEditNextDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground self-end pb-1.5">Applies to your forecast immediately.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="px-4 pb-4 text-xs text-muted-foreground">
        “Not recurring” only removes an item from forecasts — the underlying transactions stay in Books untouched.
      </p>
    </div>
  );
}
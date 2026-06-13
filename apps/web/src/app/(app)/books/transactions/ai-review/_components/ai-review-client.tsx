"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader, Button, Badge, Card, CardContent, formatCurrency, formatDate } from "@cashpile/ui";
import type { AiReviewSuggestion } from "@/modules/books/actions/ai-review.actions";

type Data = {
  suggestions: AiReviewSuggestion[];
  categories: Array<{ id: string | number; name: string; parent_category_id?: string | number | null }>;
  taxEntities: Array<{ id: string; name: string; entity_type?: string }>;
};

function categoryLabel(category: Data["categories"][number], categories: Data["categories"]) {
  const parent = category.parent_category_id
    ? categories.find((item) => String(item.id) === String(category.parent_category_id))
    : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return "High";
  if (confidence >= 0.75) return "Medium";
  return "Needs review";
}

export default function AiReviewClient({ initialData }: { initialData: Data }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialData.suggestions);
  const [drafts, setDrafts] = useState<Record<string, { categoryId: string; taxEntityId: string; applyAccountDefault: boolean }>>(() =>
    Object.fromEntries(initialData.suggestions.map((suggestion) => [
      suggestion.id,
      {
        categoryId: suggestion.suggestedCategoryId ? String(suggestion.suggestedCategoryId) : "",
        taxEntityId: suggestion.suggestedTaxEntityId ?? "",
        applyAccountDefault: false,
      },
    ]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateDraft(id: string, patch: Partial<{ categoryId: string; taxEntityId: string; applyAccountDefault: boolean }>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function acceptSuggestion(suggestion: AiReviewSuggestion) {
    const draft = drafts[suggestion.id];
    if (!draft?.categoryId && !draft?.taxEntityId) {
      toast.error("Choose a category, Tax Entity, or both");
      return;
    }

    setSavingId(suggestion.id);
    try {
      const res = await fetch("/api/books/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: suggestion.transactionIds,
          pattern: suggestion.pattern,
          accountId: suggestion.accountId,
          categoryId: draft.categoryId || null,
          taxEntityId: draft.taxEntityId || null,
          applyAccountDefault: draft.applyAccountDefault,
          createRule: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to accept suggestion");

      setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      toast.success(`Applied to ${Math.max(data.updatedTransactions ?? 0, data.assignedTaxViews ?? 0, suggestion.count)} transaction${suggestion.count === 1 ? "" : "s"} and saved future rule${data.accountRuleUpdated ? " + account default" : ""}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept suggestion");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/books/transactions">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <PageHeader
        title="AI Transaction Review"
        description="Review grouped transaction patterns. Accept once to apply current assignments and create future rules."
        actions={<Button variant="outline" onClick={() => router.refresh()}>Refresh suggestions</Button>}
      />

      {suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-muted-foreground">
          <div className="font-medium text-foreground">No grouped suggestions right now</div>
          <p className="mt-2 text-sm">Cashpile did not find repeated unassigned or uncategorized transaction patterns needing review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const draft = drafts[suggestion.id] ?? { categoryId: "", taxEntityId: "", applyAccountDefault: false };
            return (
              <Card key={suggestion.id}>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{suggestion.pattern}</h2>
                        <Badge variant="secondary">{suggestion.count} transactions</Badge>
                        <Badge variant={suggestion.confidence >= 0.9 ? "default" : "outline"}>{confidenceLabel(suggestion.confidence)} confidence</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{suggestion.accountLabel} · {formatCurrency(suggestion.totalAmount)} total · {suggestion.firstDate ? formatDate(suggestion.firstDate) : "—"} to {suggestion.lastDate ? formatDate(suggestion.lastDate) : "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <Button onClick={() => acceptSuggestion(suggestion)} disabled={savingId === suggestion.id}>
                      {savingId === suggestion.id ? "Applying…" : "Accept & Create Rule"}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Category</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={draft.categoryId}
                        onChange={(event) => updateDraft(suggestion.id, { categoryId: event.target.value })}
                      >
                        <option value="">-- Leave category unchanged --</option>
                        {initialData.categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>{categoryLabel(category, initialData.categories)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Tax Entity</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={draft.taxEntityId}
                        onChange={(event) => updateDraft(suggestion.id, { taxEntityId: event.target.value })}
                      >
                        <option value="">-- Leave Tax Entity unchanged --</option>
                        {initialData.taxEntities.map((entity) => (
                          <option key={entity.id} value={entity.id}>{entity.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {suggestion.accountId && draft.taxEntityId && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={draft.applyAccountDefault}
                        onChange={(event) => updateDraft(suggestion.id, { applyAccountDefault: event.target.checked })}
                      />
                      <span>Also assign all current and future transactions from {suggestion.accountName} to this Tax Entity.</span>
                    </label>
                  )}

                  <details className="rounded-md border bg-muted/20 p-3">
                    <summary className="cursor-pointer text-sm font-medium">View sample transactions</summary>
                    <div className="mt-3 space-y-2">
                      {suggestion.examples.map((tx) => (
                        <div key={tx.id} className="grid gap-2 rounded-md bg-background p-2 text-xs sm:grid-cols-[7rem_1fr_8rem]">
                          <div className="text-muted-foreground">{formatDate(tx.date)}</div>
                          <div className="truncate">{tx.description}</div>
                          <div className="text-right font-medium">{formatCurrency(tx.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

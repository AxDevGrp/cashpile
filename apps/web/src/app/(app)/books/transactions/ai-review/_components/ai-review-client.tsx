"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader, Button, Badge, Card, CardContent, formatCurrency, formatDate } from "@cashpile/ui";
import type { AiReviewSuggestion } from "@/modules/books/actions/ai-review.actions";

type Data = {
  suggestions: AiReviewSuggestion[];
  totalSuggestions: number;
  limit: number;
  categories: Array<{ id: string | number; name: string; parent_category_id?: string | number | null }>;
  taxEntities: Array<{ id: string; name: string; entity_type?: string }>;
  accounts: Array<{ id: string; name: string; institution_name?: string | null; last_four_digits?: string | null }>;
  activeAccount: { id: string; name: string; institution_name?: string | null; last_four_digits?: string | null } | null;
};

type InstructionPreview = {
  inferredAccountName: string | null;
  inferredPattern: string | null;
  inferredCategoryName: string | null;
  inferredTaxEntityName: string | null;
  matchedTransactions: number;
  uncategorizedMatches: number;
  willSetAccountDefault: boolean;
  willCreateCategoryRule: boolean;
  willCreateTaxRule: boolean;
  ruleScope: "account" | "global";
  interpretationSource: "explicit" | "deterministic" | "ai";
  interpretationReason: string | null;
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
  const activeAccountLabel = initialData.activeAccount
    ? `${initialData.activeAccount.name}${initialData.activeAccount.last_four_digits ? ` - *${initialData.activeAccount.last_four_digits}` : ""}`
    : null;
  const [suggestions, setSuggestions] = useState(initialData.suggestions);
  const [instruction, setInstruction] = useState("");
  const [instructionAccountId, setInstructionAccountId] = useState(initialData.activeAccount?.id ?? "");
  const [instructionPattern, setInstructionPattern] = useState("");
  const [instructionCategoryId, setInstructionCategoryId] = useState("");
  const [instructionTaxEntityId, setInstructionTaxEntityId] = useState("");
  const [setAccountDefault, setSetAccountDefault] = useState(true);
  const [isApplyingInstruction, setIsApplyingInstruction] = useState(false);
  const [isPreviewingInstruction, setIsPreviewingInstruction] = useState(false);
  const [instructionPreview, setInstructionPreview] = useState<InstructionPreview | null>(null);
  const [previewSignature, setPreviewSignature] = useState("");
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { categoryId: string; taxEntityId: string; applyAccountDefault: boolean }>>(() =>
    Object.fromEntries(initialData.suggestions.map((suggestion) => [
      suggestion.id,
      {
        categoryId: suggestion.suggestedCategoryId ? String(suggestion.suggestedCategoryId) : "",
        taxEntityId: suggestion.suggestedTaxEntityId ?? "",
        applyAccountDefault: Boolean(suggestion.suggestedTaxEntityId && suggestion.accountId),
      },
    ]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const selectedSuggestions = suggestions.filter((suggestion) => selectedSuggestionIds.has(suggestion.id));
  const totalSuggestedTransactions = suggestions.reduce((sum, suggestion) => sum + suggestion.count, 0);
  const showMoreHref = `${initialData.activeAccount ? `/books/transactions/ai-review?accountId=${encodeURIComponent(initialData.activeAccount.id)}&` : "/books/transactions/ai-review?"}limit=${Math.min(initialData.limit + 100, 500)}`;
  const selectableSuggestions = suggestions.filter((suggestion) => {
    const draft = drafts[suggestion.id];
    return Boolean(draft?.categoryId || draft?.taxEntityId);
  });
  const highConfidenceSuggestions = selectableSuggestions.filter((suggestion) => suggestion.confidence >= 0.9);
  const currentInstructionSignature = JSON.stringify({
    instruction: instruction.trim(),
    accountId: instructionAccountId,
    pattern: instructionPattern.trim(),
    categoryId: instructionCategoryId,
    taxEntityId: instructionTaxEntityId,
    setAccountDefault,
  });
  const hasFreshInstructionPreview = Boolean(instructionPreview && previewSignature === currentInstructionSignature);

  function clearInstructionPreview() {
    setInstructionPreview(null);
    setPreviewSignature("");
  }

  function updateDraft(id: string, patch: Partial<{ categoryId: string; taxEntityId: string; applyAccountDefault: boolean }>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function toggleSuggestion(id: string) {
    setSelectedSuggestionIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function postSuggestion(suggestion: AiReviewSuggestion) {
    const draft = drafts[suggestion.id];
    if (!draft?.categoryId && !draft?.taxEntityId) {
      throw new Error(`Choose a category or Tax Entity for ${suggestion.pattern}`);
    }

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
    return data;
  }

  async function acceptSuggestion(suggestion: AiReviewSuggestion) {
    const draft = drafts[suggestion.id];
    if (!draft?.categoryId && !draft?.taxEntityId) {
      toast.error("Choose a category, Tax Entity, or both");
      return;
    }

    setSavingId(suggestion.id);
    try {
      const data = await postSuggestion(suggestion);

      setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      setSelectedSuggestionIds((current) => {
        const next = new Set(current);
        next.delete(suggestion.id);
        return next;
      });
      toast.success(`Applied to ${Math.max(data.updatedTransactions ?? 0, data.assignedTaxViews ?? 0, suggestion.count)} transaction${suggestion.count === 1 ? "" : "s"} and saved future rule${data.accountRuleUpdated ? " + account default" : ""}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept suggestion");
    } finally {
      setSavingId(null);
    }
  }

  async function acceptSelectedSuggestions() {
    if (selectedSuggestions.length === 0) {
      toast.error("Select suggestions first");
      return;
    }

    const missing = selectedSuggestions.filter((suggestion) => {
      const draft = drafts[suggestion.id];
      return !draft?.categoryId && !draft?.taxEntityId;
    });
    if (missing.length > 0) {
      toast.error(`Choose category or Tax Entity for ${missing[0].pattern} before bulk accepting`);
      return;
    }

    setBulkProgress({ done: 0, total: selectedSuggestions.length });
    const acceptedIds: string[] = [];
    try {
      for (let index = 0; index < selectedSuggestions.length; index += 1) {
        const suggestion = selectedSuggestions[index];
        await postSuggestion(suggestion);
        acceptedIds.push(suggestion.id);
        setBulkProgress({ done: index + 1, total: selectedSuggestions.length });
      }
      setSuggestions((current) => current.filter((suggestion) => !acceptedIds.includes(suggestion.id)));
      setSelectedSuggestionIds(new Set());
      toast.success(`Accepted ${acceptedIds.length} AI suggestion${acceptedIds.length === 1 ? "" : "s"} and saved rules`);
      router.refresh();
    } catch (error) {
      setSuggestions((current) => current.filter((suggestion) => !acceptedIds.includes(suggestion.id)));
      setSelectedSuggestionIds((current) => {
        const next = new Set(current);
        acceptedIds.forEach((id) => next.delete(id));
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Bulk accept stopped");
    } finally {
      setBulkProgress(null);
    }
  }

  async function submitInstruction(dryRun: boolean) {
    if (!instruction.trim()) {
      toast.error("Tell Cashpile what rule to create");
      return;
    }

    if (dryRun) setIsPreviewingInstruction(true);
    else setIsApplyingInstruction(true);
    try {
      const res = await fetch("/api/books/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "instruction",
          dryRun,
          instruction,
          accountId: instructionAccountId || null,
          pattern: instructionPattern || null,
          categoryId: instructionCategoryId || null,
          taxEntityId: instructionTaxEntityId || null,
          applyToExisting: true,
          setAccountDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to apply instruction");

      if (dryRun) {
        setInstructionPreview(data);
        setPreviewSignature(currentInstructionSignature);
        toast.success("Preview ready. Confirm before applying.");
        return;
      }

      toast.success(
        `Instruction applied: ${data.categorizedTransactions ?? 0} categorized, ${data.assignedTaxViews ?? 0} assigned${data.accountDefaultApplied ? ", account default saved" : ""}`
      );
      setInstruction("");
      setInstructionPattern("");
      setInstructionPreview(null);
      setPreviewSignature("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to apply instruction");
    } finally {
      if (dryRun) setIsPreviewingInstruction(false);
      else setIsApplyingInstruction(false);
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
        description={activeAccountLabel
          ? `Review suggestions for ${activeAccountLabel}. Accept once to apply current assignments and create future rules.`
          : "Review grouped patterns and high-impact one-off transactions. Accept once to apply current assignments and create future rules."}
        actions={<Button variant="outline" onClick={() => router.refresh()}>Refresh suggestions</Button>}
      />

      {activeAccountLabel && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
          <Badge variant="secondary">Account scoped</Badge>
          <span className="text-muted-foreground">Showing only transactions from</span>
          <span className="font-medium">{activeAccountLabel}</span>
          <Link href={`/books/accounts/${initialData.activeAccount!.id}/transactions`} className="ml-auto">
            <Button variant="outline" size="sm">View account transactions</Button>
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold">Teach Cashpile a rule</h2>
            <p className="text-sm text-muted-foreground">
              Tell Cashpile where an account, merchant, or repeated charge belongs. Confirm the fields below, then Cashpile applies it now and saves the rule for future transactions.
            </p>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Instruction</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={instruction}
              onChange={(event) => {
                setInstruction(event.target.value);
                clearInstructionPreview();
              }}
              placeholder={'Example: Charges from "ANTHROPIC" on Amex Blue Plus AxDevGrp belong to Axial Development Group and Software & Subscriptions.'}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Account</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={instructionAccountId}
                onChange={(event) => {
                  setInstructionAccountId(event.target.value);
                  clearInstructionPreview();
                }}
              >
                <option value="">Infer or all accounts</option>
                {initialData.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.last_four_digits ? ` - *${account.last_four_digits}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Merchant / pattern</span>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={instructionPattern}
                onChange={(event) => {
                  setInstructionPattern(event.target.value);
                  clearInstructionPreview();
                }}
                placeholder="e.g. ANTHROPIC"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Category</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={instructionCategoryId}
                onChange={(event) => {
                  setInstructionCategoryId(event.target.value);
                  clearInstructionPreview();
                }}
              >
                <option value="">Infer / leave unchanged</option>
                {initialData.categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>{categoryLabel(category, initialData.categories)}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Tax Entity</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={instructionTaxEntityId}
                onChange={(event) => {
                  setInstructionTaxEntityId(event.target.value);
                  clearInstructionPreview();
                }}
              >
                <option value="">Infer / leave unchanged</option>
                {initialData.taxEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </label>
          </div>

          {instructionAccountId && instructionTaxEntityId && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={setAccountDefault}
                onChange={(event) => {
                  setSetAccountDefault(event.target.checked);
                  clearInstructionPreview();
                }}
              />
              <span>Make this Tax Entity the default for all current and future transactions in this account.</span>
            </label>
          )}

          {instructionPreview && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <div className="font-medium">Preview</div>
              <div className="mt-1 grid gap-1 md:grid-cols-2">
                <div>Account: {instructionPreview.inferredAccountName ?? "All / not specified"}</div>
                <div>Pattern: {instructionPreview.inferredPattern ?? "Account-wide"}</div>
                <div>Category: {instructionPreview.inferredCategoryName ?? "No category change"}</div>
                <div>Tax Entity: {instructionPreview.inferredTaxEntityName ?? "No Tax Entity change"}</div>
                <div>Matches: {instructionPreview.matchedTransactions} transaction{instructionPreview.matchedTransactions === 1 ? "" : "s"}</div>
                <div>Uncategorized to update: {instructionPreview.uncategorizedMatches}</div>
                <div>Rule scope: {instructionPreview.ruleScope === "account" ? "This account only" : "All accounts"}</div>
                <div>Interpreted by: {instructionPreview.interpretationSource === "ai" ? "AI" : instructionPreview.interpretationSource === "explicit" ? "Your selected fields" : "Cashpile rules"}</div>
              </div>
              {instructionPreview.interpretationReason && (
                <div className="mt-2 text-xs">Reason: {instructionPreview.interpretationReason}</div>
              )}
              <div className="mt-2 text-xs">
                Will save: {[
                  instructionPreview.willCreateCategoryRule ? "category rule" : null,
                  instructionPreview.willCreateTaxRule ? "Tax Entity rule" : null,
                  instructionPreview.willSetAccountDefault ? "account default" : null,
                ].filter(Boolean).join(", ") || "current transaction updates only"}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => submitInstruction(true)} disabled={isPreviewingInstruction || isApplyingInstruction}>
              {isPreviewingInstruction ? "Previewing…" : "Preview Instruction"}
            </Button>
            <Button onClick={() => submitInstruction(false)} disabled={isApplyingInstruction || isPreviewingInstruction || !hasFreshInstructionPreview}>
              {isApplyingInstruction ? "Applying instruction…" : "Apply Instruction & Save Rules"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {hasFreshInstructionPreview
                ? "Preview confirmed. Apply only if the impact looks right."
                : 'Preview is required before applying. Tip: quote a merchant name like "ANTHROPIC" for merchant-specific rules.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-muted-foreground">
          <div className="font-medium text-foreground">No AI review suggestions right now</div>
          <p className="mt-2 text-sm">Cashpile did not find queued AI suggestions, repeated patterns, or high-impact unassigned/uncategorized transactions needing review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">Bulk accept reviewed suggestions</div>
                <p className="text-sm text-muted-foreground">
                  Select suggestions after confirming their Category / Tax Entity. Cashpile applies each one and saves future rules.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Showing {suggestions.length} of {initialData.totalSuggestions} suggestion{initialData.totalSuggestions === 1 ? "" : "s"}, covering {totalSuggestedTransactions} displayed transaction{totalSuggestedTransactions === 1 ? "" : "s"}; {selectableSuggestions.length} ready to accept.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSuggestionIds(new Set(highConfidenceSuggestions.map((suggestion) => suggestion.id)))}
                  disabled={bulkProgress !== null || highConfidenceSuggestions.length === 0}
                >
                  Select high confidence ({highConfidenceSuggestions.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSuggestionIds(new Set(selectableSuggestions.map((suggestion) => suggestion.id)))}
                  disabled={bulkProgress !== null || selectableSuggestions.length === 0}
                >
                  Select all ready ({selectableSuggestions.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSuggestionIds(new Set())}
                  disabled={bulkProgress !== null || selectedSuggestionIds.size === 0}
                >
                  Clear
                </Button>
                <Button onClick={acceptSelectedSuggestions} disabled={bulkProgress !== null || selectedSuggestionIds.size === 0}>
                  {bulkProgress ? `Applying ${bulkProgress.done}/${bulkProgress.total}…` : `Accept selected & save rules (${selectedSuggestionIds.size})`}
                </Button>
                {suggestions.length < initialData.totalSuggestions && (
                  <Link href={showMoreHref}>
                    <Button variant="outline" disabled={bulkProgress !== null}>Show more</Button>
                  </Link>
                )}
              </div>
            </div>
            {bulkProgress && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {suggestions.map((suggestion) => {
            const draft = drafts[suggestion.id] ?? { categoryId: "", taxEntityId: "", applyAccountDefault: Boolean(suggestion.suggestedTaxEntityId && suggestion.accountId) };
            return (
              <Card key={suggestion.id}>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{suggestion.pattern}</h2>
                        <Badge variant="secondary">{suggestion.count} transactions</Badge>
                        <Badge variant={suggestion.confidence >= 0.9 ? "default" : "outline"}>{confidenceLabel(suggestion.confidence)} confidence</Badge>
                        {suggestion.suggestedCategoryName && (
                          <Badge variant="outline">Suggested category: {suggestion.suggestedCategoryName}</Badge>
                        )}
                        {suggestion.suggestedTaxEntityName && (
                          <Badge variant="outline">Suggested entity: {suggestion.suggestedTaxEntityName}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{suggestion.accountLabel} · {formatCurrency(suggestion.totalAmount)} total · {suggestion.firstDate ? formatDate(suggestion.firstDate) : "—"} to {suggestion.lastDate ? formatDate(suggestion.lastDate) : "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectedSuggestionIds.has(suggestion.id)}
                          onChange={() => toggleSuggestion(suggestion.id)}
                          disabled={bulkProgress !== null}
                        />
                        Select
                      </label>
                      <Button onClick={() => acceptSuggestion(suggestion)} disabled={savingId === suggestion.id || bulkProgress !== null}>
                        {savingId === suggestion.id ? "Applying…" : "Accept & Save Rule"}
                      </Button>
                    </div>
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
                    <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${draft.applyAccountDefault ? "border-blue-200 bg-blue-50 text-blue-900" : "text-muted-foreground"}`}>
                      <input
                        type="checkbox"
                        checked={draft.applyAccountDefault}
                        onChange={(event) => updateDraft(suggestion.id, { applyAccountDefault: event.target.checked })}
                      />
                      <span>Also assign all current and future transactions from {suggestion.accountName} to this Tax Entity{draft.applyAccountDefault ? " (account default will be saved)" : ""}.</span>
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

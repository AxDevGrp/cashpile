"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent } from "@cashpile/ui";
import { CategorySelectWithCreate } from "./category-select-with-create";

type Category = { id: string | number; name: string; category_type?: string | null; parent_category_id?: string | number | null };
type TaxEntity = { id: string; name: string; entity_type?: string | null };
type Account = { id: string; name: string; institution_name?: string | null; last_four_digits?: string | null };

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

export function AskCashpilePanel({
  categories,
  taxEntities,
  accounts,
  defaultAccountId = "",
  title = "Ask Cashpile",
  description = "Tell Cashpile what belongs where. Preview the impact, then apply it and save rules for the future.",
}: {
  categories: Category[];
  taxEntities: TaxEntity[];
  accounts: Account[];
  defaultAccountId?: string;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [instruction, setInstruction] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [taxEntityId, setTaxEntityId] = useState("");
  const [setAccountDefault, setSetAccountDefault] = useState(true);
  const [preview, setPreview] = useState<InstructionPreview | null>(null);
  const [previewSignature, setPreviewSignature] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const currentSignature = JSON.stringify({
    instruction: instruction.trim(),
    accountId,
    pattern: pattern.trim(),
    categoryId,
    taxEntityId,
    setAccountDefault,
  });
  const hasFreshPreview = Boolean(preview && previewSignature === currentSignature);

  function clearPreview() {
    setPreview(null);
    setPreviewSignature("");
  }

  async function submit(dryRun: boolean) {
    if (!instruction.trim()) {
      toast.error("Tell Cashpile what to do first");
      return;
    }

    if (dryRun) setIsPreviewing(true);
    else setIsApplying(true);

    try {
      const res = await fetch("/api/books/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "instruction",
          dryRun,
          instruction,
          accountId: accountId || null,
          pattern: pattern || null,
          categoryId: categoryId || null,
          taxEntityId: taxEntityId || null,
          applyToExisting: true,
          setAccountDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to apply instruction");

      if (dryRun) {
        setPreview(data);
        setPreviewSignature(currentSignature);
        toast.success("Preview ready. Confirm before applying.");
        return;
      }

      toast.success(
        `Cashpile applied it: ${data.categorizedTransactions ?? 0} categorized, ${data.assignedTaxViews ?? 0} assigned${data.accountDefaultApplied ? ", account default saved" : ""}`
      );
      setInstruction("");
      setPattern("");
      setPreview(null);
      setPreviewSignature("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to apply instruction");
    } finally {
      if (dryRun) setIsPreviewing(false);
      else setIsApplying(false);
    }
  }

  return (
    <Card className="border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card">
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{title}</h2>
              <Badge variant="secondary">AI first</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
          <Link href="/books/transactions/ai-review">
            <Button variant="outline" size="sm">Open full AI Review</Button>
          </Link>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">What should Cashpile do?</span>
          <textarea
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm"
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value);
              clearPreview();
            }}
            placeholder={'Example: Charges from "ANTHROPIC" on Amex Blue Plus AxDevGrp belong to Axial Development Group and Software & Subscriptions.'}
          />
        </label>

        <details className="rounded-lg border bg-background/70 p-3">
          <summary className="cursor-pointer text-sm font-medium">Optional: confirm exact account, merchant, category, or Tax Entity</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Account</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value);
                  clearPreview();
                }}
              >
                <option value="">Infer or all accounts</option>
                {accounts.map((account) => (
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
                value={pattern}
                onChange={(event) => {
                  setPattern(event.target.value);
                  clearPreview();
                }}
                placeholder="e.g. ANTHROPIC"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Category</span>
              <CategorySelectWithCreate
                value={categoryId}
                onChange={(value: string) => {
                  setCategoryId(value);
                  clearPreview();
                }}
                categories={categoryOptions}
                onCategoriesChange={setCategoryOptions}
                blankLabel="Infer / leave unchanged"
                onBeforeCreate={clearPreview}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Tax Entity</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={taxEntityId}
                onChange={(event) => {
                  setTaxEntityId(event.target.value);
                  clearPreview();
                }}
              >
                <option value="">Infer / leave unchanged</option>
                {taxEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </label>
          </div>
        </details>

        {accountId && taxEntityId && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={setAccountDefault}
              onChange={(event) => {
                setSetAccountDefault(event.target.checked);
                clearPreview();
              }}
            />
            <span>Make this Tax Entity the default for all current and future transactions in this account.</span>
          </label>
        )}

        {preview && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <div className="font-medium">Cashpile preview</div>
            <div className="mt-2 grid gap-1 md:grid-cols-2">
              <div>Account: {preview.inferredAccountName ?? "All / not specified"}</div>
              <div>Pattern: {preview.inferredPattern ?? "Account-wide"}</div>
              <div>Category: {preview.inferredCategoryName ?? "No category change"}</div>
              <div>Tax Entity: {preview.inferredTaxEntityName ?? "No Tax Entity change"}</div>
              <div>Matches: {preview.matchedTransactions} transaction{preview.matchedTransactions === 1 ? "" : "s"}</div>
              <div>Uncategorized to update: {preview.uncategorizedMatches}</div>
              <div>Scope: {preview.ruleScope === "account" ? "This account only" : "All accounts"}</div>
              <div>Interpreted by: {preview.interpretationSource === "ai" ? "AI" : preview.interpretationSource === "explicit" ? "Your selected fields" : "Cashpile rules"}</div>
            </div>
            {preview.interpretationReason && <div className="mt-2 text-xs">Reason: {preview.interpretationReason}</div>}
            <div className="mt-2 text-xs">
              Will save: {[
                preview.willCreateCategoryRule ? "category rule" : null,
                preview.willCreateTaxRule ? "Tax Entity rule" : null,
                preview.willSetAccountDefault ? "account default" : null,
              ].filter(Boolean).join(", ") || "current transaction updates only"}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => submit(true)} disabled={isPreviewing || isApplying}>
            {isPreviewing ? "Previewing…" : "Preview"}
          </Button>
          <Button onClick={() => submit(false)} disabled={isApplying || isPreviewing || !hasFreshPreview}>
            {isApplying ? "Applying…" : "Apply & Save Rules"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {hasFreshPreview ? "Preview confirmed. Apply will update matching transactions and save rules." : "Preview is required before applying."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@cashpile/ui";
import { saveConsumerReviewAction } from "@/modules/books/actions/consumer-review.actions";
import { consumerReviewSkipKey } from "@/components/ui-v2/consumer-model";

interface ReviewItem {
  transactionId: string;
  revision: number;
  date: string;
  description: string;
  amountCents: number;
  accountId: string;
  accountLabel: string;
  kind: string;
  categoryId: number | null;
  suggestion: unknown;
}

interface ReviewPage {
  items: ReviewItem[];
  total: number;
  debitCents: number;
  creditCents: number;
  nextCursor: string | null;
}

const DEBIT_OPTIONS: Array<[string, string]> = [
  ["spend", "Spend"],
  ["internal_transfer", "Own-account transfer"],
  ["card_payment", "Card payment"],
  ["unknown", "Something else"],
];

const CREDIT_OPTIONS: Array<[string, string]> = [
  ["income", "Income"],
  ["passive_income", "Passive-income receipt"],
  ["refund", "Refund"],
  ["internal_transfer", "Own-account transfer"],
  ["asset_sale", "Asset-sale proceeds"],
  ["loan_proceeds", "Loan proceeds"],
  ["unknown", "Something else"],
];

const REMEMBERABLE = new Set(["spend", "income", "passive_income", "refund"]);

export function ConsumerReviewClient({
  initial,
  categories = [],
  userId,
}: {
  initial: ReviewPage;
  categories?: Array<{ id: number; name: string }>;
  userId: string;
}) {
  const router = useRouter();
  const skipKey = consumerReviewSkipKey(userId);
  const [page, setPage] = useState<ReviewPage>(initial);
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [skippedDemo, setSkippedDemo] = useState(false);

  const loadSkipped = useCallback((): Set<string> => {
    try {
      const raw = sessionStorage.getItem(skipKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }, []);

  const visible = useMemo(() => page.items.filter((item) => !loadSkipped().has(item.transactionId)), [page, loadSkipped]);

  const item = visible[index] ?? null;

  useEffect(() => {
    setKind(null);
    setCategoryId(item?.categoryId ?? null);
    setRemember(false);
    setError(null);
  }, [item?.transactionId]);

  function persistSkipped(id: string) {
    try {
      const set = loadSkipped();
      set.add(id);
      sessionStorage.setItem(skipKey, JSON.stringify([...set]));
    } catch {}
  }

  function advance() {
    if (index + 1 < page.items.length) setIndex(index + 1);
    else setSkippedDemo(true);
  }

  async function save() {
    if (!item || kind === null || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await saveConsumerReviewAction({
        transactionId: item.transactionId,
        expectedRevision: item.revision,
        kind,
        categoryId,
        remember: remember && REMEMBERABLE.has(kind) ? true : false,
      });
      const review = (result as { review?: { count: number; debitCents: number; creditCents: number } }).review;
      setPage((prev) => ({
        ...prev,
        ...(review ?? {}),
        items: prev.items.filter((it) => it.transactionId !== item.transactionId),
      }));
      setReviewedCount((n) => n + 1);
      router.refresh();
      // The resolved row leaves the list; the next item shifts into this index.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      if (message.includes("revision_conflict")) {
        setError("This transaction changed; review it again.");
      } else {
        setError("We couldn't save that. Your selection is kept — try again.");
      }
    } finally {
      setPending(false);
    }
  }

  if (skippedDemo || !item) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto space-y-3">
        <h1 className="text-xl font-semibold">Done for now</h1>
        <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
          {page.total} still unresolved. Reviewing more will help sharpen your numbers.
        </p>
        <button
          type="button"
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "var(--cp-lime, #c7f65a)", color: "var(--cp-on-lime, #11180a)" }}
          onClick={() => {
            setSkippedDemo(false);
            setIndex(0);
          }}
        >
          Restart
        </button>
      </div>
    );
  }

  const isDebit = item.amountCents < 0;
  const options = isDebit ? DEBIT_OPTIONS : CREDIT_OPTIONS;
  const canRemember = kind !== null && REMEMBERABLE.has(kind);
  const showCategory = kind === "spend" || kind === "income";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold">Review a transaction</h1>
      <p className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
        {index + 1} of {visible.length} · {reviewedCount} reviewed this session
      </p>

      <section className="rounded-2xl p-5 space-y-1" style={{ background: "var(--cp-surface, #252b34)" }}>
        <p className="text-lg font-medium truncate">{item.description}</p>
        <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
          {item.accountLabel} · {item.date}
        </p>
        <p className={`text-2xl font-bold tabular-nums ${isDebit ? "" : ""}`}>
          {formatCurrency(item.amountCents / 100)}
        </p>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold mb-1">What is this?</legend>
        {options.map(([value, label]) => (
          <label
            key={value}
            className="flex items-center gap-3 rounded-lg border px-3 py-3 min-h-[44px]"
            style={{ borderColor: "var(--cp-border, #46515f)" }}
          >
            <input
              type="radio"
              name="kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {showCategory ? (
        <label className="block text-sm">
          <span className="font-semibold">Category (optional)</span>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[44px]"
            style={{ borderColor: "var(--cp-border, #46515f)" }}
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{item.categoryId === null ? "Leave uncategorized" : "Keep current category"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={remember && canRemember}
          disabled={!canRemember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Remember this exact match for future imports
          <span className="block text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            Applies only to this account, this exact description and amount. Never to history.
          </span>
        </span>
      </label>

      {error ? (
        <p role="status" className="text-sm" style={{ color: "var(--cp-danger, #ff8c88)" }}>
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={kind === null || pending}
          onClick={save}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          style={{ background: "var(--cp-lime, #c7f65a)", color: "var(--cp-on-lime, #11180a)" }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            persistSkipped(item.transactionId);
            advance();
          }}
          className="rounded-lg border px-4 py-2 text-sm font-medium min-h-[44px]"
          style={{ borderColor: "var(--cp-border, #46515f)" }}
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => router.push("/cashboard")}
          className="rounded-lg px-4 py-2 text-sm min-h-[44px]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

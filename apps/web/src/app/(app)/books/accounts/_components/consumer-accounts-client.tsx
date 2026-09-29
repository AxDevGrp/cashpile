"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@cashpile/ui";
import { updateAccount } from "@/modules/books/actions/account.actions";

interface AccountRow {
  id: string;
  name: string;
  account_type: string | null;
  institution_name: string | null;
  current_balance: number | null;
  currency_code: string | null;
  cashflow_include: boolean | null;
  cashflow_role: string | null;
  plaid_item_id: string | null;
  is_emergency: boolean | null;
  tax_entity_id: string | null;
}

interface PlaidItemRow {
  id: string;
  institution_name: string | null;
  status: string | null;
  last_synced_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  spending_source: "Spending",
  reserve: "Reserve",
  credit_liability: "Credit",
  investment: "Investment",
  loan: "Loan",
  ignore: "Not included",
};

const PROPOSED: Record<string, string> = {
  checking: "spending_source",
  savings: "reserve",
  credit_card: "credit_liability",
  investment: "investment",
  loan: "loan",
  other: "ignore",
};

interface Draft {
  include: boolean | null;
  role: string | null;
  emergency: boolean;
  currency: string | null;
}

export function ConsumerAccountsClient({
  accounts,
  plaidItems,
  jobCounts,
}: {
  accounts: AccountRow[];
  plaidItems: PlaidItemRow[];
  jobCounts: { pending: number; processing: number; done: number; failed: number };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      accounts.map((a) => [
        a.id,
        {
          include: a.cashflow_include,
          role: a.cashflow_role ?? PROPOSED[a.account_type ?? "other"] ?? "ignore",
          emergency: a.is_emergency === true,
          currency: a.currency_code,
        },
      ])
    )
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(
    () =>
      accounts.filter((a) => {
        const d = draft[a.id];
        return (
          d.include !== a.cashflow_include ||
          d.role !== a.cashflow_role ||
          d.emergency !== (a.is_emergency === true) ||
          d.currency !== a.currency_code
        );
      }),
    [accounts, draft]
  );

  function patch(id: string, next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      for (const account of dirty) {
        const d = draft[account.id];
        await updateAccount(account.id, {
          cashflow_include: d.include,
          cashflow_role: d.role,
          is_emergency: d.emergency,
          currency_code: d.currency,
        });
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your choices");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Accounts</h1>

      {plaidItems.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Connections</h2>
          {plaidItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl p-3 text-sm flex items-center justify-between gap-3"
              style={{ background: "var(--cp-surface, #252b34)" }}
            >
              <span className="truncate">{item.institution_name ?? "Linked institution"}</span>
              <span className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
                {item.status ?? "unknown"}
                {item.last_synced_at ? ` · ${new Date(item.last_synced_at).toLocaleDateString()}` : ""}
              </span>
            </div>
          ))}
          <p className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            Interpretation jobs — pending {jobCounts.pending}, processing {jobCounts.processing}, done{" "}
            {jobCounts.done}, failed {jobCounts.failed}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Your plan</h2>
        {accounts.map((account) => {
          const d = draft[account.id];
          const proposed = PROPOSED[account.account_type ?? "other"] ?? "ignore";
          const hasProposal = account.cashflow_role == null && d.role === proposed;
          return (
            <div key={account.id} className="rounded-2xl p-4 space-y-3" style={{ background: "var(--cp-surface, #252b34)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{account.name}</p>
                  <p className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
                    {account.institution_name ?? "Manual"}
                    {account.currency_code ? "" : " · currency unconfirmed"}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">
                  {account.current_balance == null ? "—" : formatCurrency(Number(account.current_balance))}
                </span>
              </div>

              {account.currency_code == null ? (
                <button
                  type="button"
                  onClick={() => patch(account.id, { currency: "USD" })}
                  className="rounded-lg border px-3 py-1.5 text-xs min-h-[44px]"
                  style={{ borderColor: "var(--cp-border, #46515f)" }}
                >
                  Confirm currency (USD)
                </button>
              ) : null}

              {account.tax_entity_id ? (
                <p className="text-xs" style={{ color: "var(--cp-attention, #f3c76a)" }}>
                  Linked to a business/tax entity. Including it here blends business and personal cash — your choice is kept.
                </p>
              ) : null}

              <label className="flex items-center gap-2 text-sm min-h-[44px]">
                <input
                  type="checkbox"
                  checked={d.include === true}
                  onChange={(e) => patch(account.id, { include: e.target.checked })}
                />
                Include in my personal plan
              </label>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Role
                  <select
                    value={d.role ?? "ignore"}
                    onChange={(e) => patch(account.id, { role: e.target.value })}
                    className="rounded-lg border px-2 py-1.5 min-h-[44px]"
                    style={{ borderColor: "var(--cp-border, #46515f)" }}
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {hasProposal ? (
                  <span className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
                    Proposed
                  </span>
                ) : null}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.emergency}
                    disabled={d.role !== "reserve"}
                    onChange={(e) => patch(account.id, { emergency: e.target.checked })}
                  />
                  Emergency reserve
                </label>
              </div>
            </div>
          );
        })}
      </section>

      {error ? (
        <p role="status" className="text-sm" style={{ color: "var(--cp-danger, #ff8c88)" }}>
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p role="status" className="text-sm" style={{ color: "var(--cp-lime, #c7f65a)" }}>
          Saved.
        </p>
      ) : null}

      <button
        type="button"
        onClick={confirm}
        disabled={pending || dirty.length === 0}
        className="rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] disabled:opacity-50"
        style={{ background: "var(--cp-lime, #c7f65a)", color: "var(--cp-on-lime, #11180a)" }}
      >
        {pending ? "Saving…" : "Confirm choices"}
      </button>
    </div>
  );
}

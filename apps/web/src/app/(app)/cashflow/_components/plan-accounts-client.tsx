"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CashflowAccount, CashflowRole } from "@cashpile/ai";
import { updateAccountPlanSettings } from "../actions";

const DEFAULT_ROLE_BY_TYPE: Record<string, CashflowRole> = {
  checking: "spending_source",
  savings: "spending_source",
  other: "spending_source",
  credit_card: "credit_liability",
  investment: "investment",
  loan: "loan",
};

function defaultRoleFor(accountType: string): CashflowRole {
  return DEFAULT_ROLE_BY_TYPE[accountType] ?? "spending_source";
}

const ROLES: Array<{ value: CashflowRole; label: string }> = [
  { value: "spending_source", label: "Spending cash" },
  { value: "reserve", label: "Savings / reserve" },
  { value: "credit_liability", label: "Credit card" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "ignore", label: "Not in my plan" },
];

interface Props {
  accounts: CashflowAccount[];
}

export default function PlanAccountsClient({ accounts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function update(account: CashflowAccount, changes: { role?: CashflowRole; included?: boolean; isEmergency?: boolean }) {
    startTransition(async () => {
      try {
        await updateAccountPlanSettings({ accountId: account.id, ...changes });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update account");
      }
    });
  }

  if (!accounts.length) {
    return <p className="text-sm text-muted-foreground">No active accounts yet. Connect an account or add one in Books.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Choose which accounts belong to your personal plan and what each one is for. Only spending cash counts as
        spendable; emergency-designated reserves back your cushion.
      </p>
      <div className="divide-y rounded-xl border border-border">
        {accounts.map((account) => {
          return (
            <div key={account.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {account.name}
                  {account.isEmergency && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Emergency fund</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{account.accountType.replace("_", " ")}</div>
              </div>
              <select
                value={account.role}
                onChange={(e) => update(account, { role: e.target.value as CashflowRole })}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                aria-label={`Role for ${account.name}`}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {account.role === "reserve" && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!!account.isEmergency}
                    onChange={(e) => update(account, { isEmergency: e.target.checked })}
                    className="rounded border-border"
                  />
                  Emergency
                </label>
              )}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={account.included && account.role !== "ignore"}
                  onChange={(e) =>
                    update(account, e.target.checked
                      ? { role: account.role === "ignore" ? defaultRoleFor(account.accountType) : undefined, included: true }
                      : { role: "ignore", included: true })
                  }
                  className="rounded border-border"
                />
                In my plan
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
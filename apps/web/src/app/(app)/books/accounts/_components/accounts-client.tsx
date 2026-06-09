"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import PlaidLinkButton from "@/components/plaid-link-button";
import type { TaxEntity, BooksAccount } from "@/modules/books/types";
import { assignAccountToTaxEntity, mergeFinancialAccounts, updateAccount } from "@/modules/books/actions/account.actions";

interface PlaidItem {
  id: string;
  item_id: string;
  tax_entity_id?: string | null;
  uda_id?: string | null; // DEPRECATED
  institution_name: string | null;
  status: string;
  last_synced_at: string | null;
}

interface Props {
  taxEntities: TaxEntity[];
  accounts: BooksAccount[];
  plaidItems: PlaidItem[];
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking:    "Checking",
  savings:     "Savings",
  credit_card: "Credit Card",
  loan:        "Loan",
  investment:  "Investment",
  other:       "Other",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  llc: "LLC",
  s_corp: "S-Corp",
  c_corp: "C-Corp",
  partnership: "Partnership",
  sole_proprietorship: "Sole Proprietorship",
  rental_property: "Rental Property",
};

function isInstitutionalAccount(account: BooksAccount) {
  return Boolean(account.plaid_account_id || account.plaid_item_id);
}

function accountInstitutionLabel(account: BooksAccount) {
  const institution = account.institution_name ?? account.institution ?? "—";
  return `${institution}${account.last_four_digits ? ` - *${account.last_four_digits}` : ""}`;
}

function BackButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/books";
      }}
    >
      ← Back
    </Button>
  );
}

function AccountCard({
  account,
  plaidItem,
  taxEntities,
  onAssign,
  onMerge,
  onRename,
}: {
  account: BooksAccount;
  plaidItem?: PlaidItem;
  taxEntities: TaxEntity[];
  onAssign: (accountId: string, taxEntityId: string | null) => void;
  onMerge: (account: BooksAccount) => void;
  onRename: (accountId: string, name: string) => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(account.name);
  const [savingName, setSavingName] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillSummary, setBackfillSummary] = useState<string | null>(null);

  async function handleRefresh() {
    if (!plaidItem) return;
    setSyncing(true);
    await fetch("/api/plaid/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: plaidItem.item_id }),
    });
    setSyncing(false);
    window.location.reload();
  }

  async function handleBackfill2025() {
    if (!plaidItem) {
      setBackfillSummary("Cannot backfill yet because Cashpile cannot find this account’s stored Plaid connection. Use Connect bank again first, then run Backfill 2025.");
      return;
    }
    if (!window.confirm(`Backfill 2025 Plaid transactions for "${account.name}"? This will only ask Plaid for this account and will not duplicate existing Plaid transaction IDs.`)) return;

    setBackfilling(true);
    setBackfillSummary(null);
    try {
      const res = await fetch("/api/plaid/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: account.id,
          start_date: "2025-01-01",
          end_date: "2025-12-31",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Plaid backfill failed");

      const result = data.results?.[0];
      if (result?.error) throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));

      const returned = Number(result?.plaid_returned ?? result?.total_returned ?? 0);
      const available = Number(result?.total_available ?? returned);
      const upserted = Number(result?.upserted ?? result?.total_upserted ?? 0);
      const categorized = Number(result?.categorized ?? 0);
      const needsReconnect = returned === 0;
      setBackfillSummary(
        needsReconnect
          ? "Plaid returned 0 transactions for 2025. Reconnect this bank with 24-month history, then run backfill again."
          : `Backfill finished: Plaid returned ${returned}${available !== returned ? ` of ${available} available` : ""}, upserted ${upserted}, and auto-categorized ${categorized}.`
      );
      if (upserted > 0) window.location.reload();
    } catch (error) {
      setBackfillSummary(error instanceof Error ? error.message : "Plaid backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  const assignedEntity = taxEntities.find(e => e.id === account.tax_entity_id);
  const isPlaidLinked = Boolean(plaidItem || account.plaid_account_id || account.plaid_item_id);
  const canReconnectPlaidItem = Boolean(plaidItem?.id && plaidItem?.item_id);

  async function saveName() {
    const nextName = nameDraft.trim();
    if (!nextName || nextName === account.name) {
      setNameDraft(account.name);
      setIsRenaming(false);
      return;
    }
    setSavingName(true);
    try {
      await onRename(account.id, nextName);
      setIsRenaming(false);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isRenaming ? (
              <div className="space-y-2">
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveName();
                    if (event.key === "Escape") { setNameDraft(account.name); setIsRenaming(false); }
                  }}
                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm font-medium"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={saveName} disabled={savingName}>{savingName ? "Saving…" : "Save"}</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setNameDraft(account.name); setIsRenaming(false); }} disabled={savingName}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href={`/books/accounts/${account.id}/transactions`} className="hover:underline">
                  <CardTitle className="text-base">{account.name}</CardTitle>
                </Link>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setIsRenaming(true)}>Edit</Button>
              </div>
            )}
            {(account.institution_name || account.institution || account.last_four_digits) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {accountInstitutionLabel(account)}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {plaidItem ? (
              <>
                <Badge variant={plaidItem.status === "active" ? "default" : "destructive"} className="text-xs">
                  {plaidItem.institution_name ?? "Connected"}
                </Badge>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleRefresh} disabled={syncing}>
                  {syncing ? "Syncing…" : "Refresh"}
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="text-xs">
                UDA
              </Badge>
            )}
          </div>
        </div>
        {plaidItem?.last_synced_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Last synced {new Date(plaidItem.last_synced_at).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
          </Badge>
          {account.current_balance != null && (
            <span className="text-muted-foreground text-sm">
              ${Number(account.current_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Tax Entity Assignment */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {assignedEntity ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tax Entity:</span>
                  <Badge variant="secondary" className="text-xs">{assignedEntity.name}</Badge>
                </div>
              ) : (
                <span className="text-muted-foreground">Not assigned to a Tax Entity</span>
              )}
            </div>
            <div className="flex gap-1">
              <Link href={`/books/accounts/${account.id}/transactions`}>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
                  Transactions
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setIsAssigning(!isAssigning)}
              >
                {isAssigning ? "Cancel" : assignedEntity ? "Change" : "Assign"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => onMerge(account)}
              >
                Merge
              </Button>
            </div>
          </div>
          {isPlaidLinked && (
            <div className="mt-3 rounded-md border border-border bg-muted/20 p-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                {canReconnectPlaidItem
                  ? "Plaid reconnects the bank connection that owns this account, not one account by itself."
                  : "This account has Plaid account data, but Cashpile cannot find its stored Plaid connection. Connect the bank again to request more history."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleBackfill2025} disabled={backfilling}>
                  {backfilling ? "Backfilling…" : "Backfill 2025"}
                </Button>
                {canReconnectPlaidItem ? (
                  <PlaidLinkButton
                    taxEntityId={account.tax_entity_id ?? undefined}
                    updatePlaidItemId={plaidItem!.id}
                    updateItemId={plaidItem!.item_id}
                    backfillAccountId={account.id}
                    label="Reconnect bank + backfill 2025"
                  />
                ) : (
                  <PlaidLinkButton
                    taxEntityId={account.tax_entity_id ?? undefined}
                    replaceAccountId={account.id}
                    label="Connect bank again"
                  />
                )}
              </div>
              {backfillSummary && (
                <p className="text-xs text-muted-foreground">{backfillSummary}</p>
              )}
            </div>
          )}
          
          {isAssigning && (
            <div className="mt-2 space-y-2">
              <select
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                value={account.tax_entity_id ?? ""}
                onChange={(e) => {
                  const newEntityId = e.target.value || null;
                  onAssign(account.id, newEntityId);
                  setIsAssigning(false);
                }}
              >
                <option value="">-- Not Assigned --</option>
                {taxEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MergeAccountModal({
  keepAccount,
  accounts,
  onClose,
  onMerged,
}: {
  keepAccount: BooksAccount;
  accounts: BooksAccount[];
  onClose: () => void;
  onMerged: (deletedAccountId: string, updatedKeepAccount: Partial<BooksAccount> & { id: string }) => void;
}) {
  const candidates = accounts.filter((account) => account.id !== keepAccount.id);
  const [mergeAccountId, setMergeAccountId] = useState(candidates[0]?.id ?? "");
  const [useMergedAccountName, setUseMergedAccountName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ movedTransactions: number } | null>(null);

  const mergeAccount = accounts.find((account) => account.id === mergeAccountId);

  async function handleMerge() {
    if (!mergeAccount) return;
    if (!window.confirm(`Merge "${mergeAccount.name}" into "${keepAccount.name}"? This moves transactions and deletes the duplicate account.`)) return;

    setSaving(true);
    try {
      const mergeResult = await mergeFinancialAccounts({
        keepAccountId: keepAccount.id,
        mergeAccountId: mergeAccount.id,
        useMergedAccountName,
      });
      setResult({ movedTransactions: mergeResult.movedTransactions });
      onMerged(mergeResult.deletedAccountId, {
        id: keepAccount.id,
        name: useMergedAccountName ? mergeAccount.name : keepAccount.name,
        tax_entity_id: keepAccount.tax_entity_id ?? mergeAccount.tax_entity_id,
        institution_name: keepAccount.institution_name ?? mergeAccount.institution_name,
        institution: keepAccount.institution ?? mergeAccount.institution,
        last_four_digits: keepAccount.last_four_digits ?? mergeAccount.last_four_digits,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to merge accounts");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-semibold">Merge Duplicate Account</div>
            <div className="text-xs text-muted-foreground">Keep {keepAccount.name}; move another account into it.</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-md bg-muted/30 p-3 text-sm">
            <div className="text-muted-foreground text-xs">Account to keep</div>
            <div className="font-medium">{keepAccount.name}</div>
            <div className="text-xs text-muted-foreground">{accountInstitutionLabel(keepAccount)}</div>
            <div className="text-xs text-muted-foreground">Balance {keepAccount.current_balance == null ? "—" : Number(keepAccount.current_balance).toLocaleString("en-US", { style: "currency", currency: "USD" })}</div>
          </div>

          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Duplicate account to merge/delete</span>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
              value={mergeAccountId}
              onChange={(event) => setMergeAccountId(event.target.value)}
            >
              {candidates.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {accountInstitutionLabel(account)} · {account.current_balance == null ? "—" : Number(account.current_balance).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </option>
              ))}
            </select>
          </label>

          {mergeAccount && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={useMergedAccountName} onChange={(event) => setUseMergedAccountName(event.target.checked)} />
              <span>Rename kept account to “{mergeAccount.name}”</span>
            </label>
          )}

          <div className="text-xs text-muted-foreground">
            This moves transactions from the duplicate account into the kept account, preserves tax assignments through those transactions, and deletes the duplicate account.
          </div>

          {result && (
            <div className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
              Done — moved {result.movedTransactions} transaction{result.movedTransactions === 1 ? "" : "s"}.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
          {!result && <Button onClick={handleMerge} disabled={saving || !mergeAccountId}>{saving ? "Merging…" : "Merge Accounts"}</Button>}
        </div>
      </div>
    </div>
  );
}

export default function AccountsClient({ taxEntities, accounts, plaidItems }: Props) {
  const [localAccounts, setLocalAccounts] = useState(accounts);
  const [mergeTarget, setMergeTarget] = useState<BooksAccount | null>(null);

  const getPlaidItem = (accountId: string) => {
    const account = localAccounts.find(a => a.id === accountId);
    return plaidItems.find((p) => p.id === account?.plaid_item_id);
  };

  async function handleAssign(accountId: string, taxEntityId: string | null) {
    try {
      await assignAccountToTaxEntity(accountId, taxEntityId);
      setLocalAccounts(prev =>
        prev.map(a => a.id === accountId ? { ...a, tax_entity_id: taxEntityId } : a)
      );
    } catch (err) {
      console.error("Failed to assign account:", err);
      alert("Failed to assign account to Tax Entity");
    }
  }

  async function handleRename(accountId: string, name: string) {
    try {
      await updateAccount(accountId, { name });
      setLocalAccounts(prev =>
        prev.map(a => a.id === accountId ? { ...a, name } : a)
      );
    } catch (err) {
      console.error("Failed to rename account:", err);
      alert("Failed to rename account");
      throw err;
    }
  }

  // Group accounts by tax entity
  const accountsByEntity = new Map<string | null, BooksAccount[]>();
  accountsByEntity.set(null, []); // Unassigned
  taxEntities.forEach(e => accountsByEntity.set(e.id, []));
  
  localAccounts.forEach(account => {
    const entityId = account.tax_entity_id ?? null;
    const list = accountsByEntity.get(entityId) ?? [];
    list.push(account);
    accountsByEntity.set(entityId, list);
  });

  const unassignedAccounts = accountsByEntity.get(null) ?? [];

  if (taxEntities.length === 0 && accounts.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <BackButton />
        <PageHeader
          title="Accounts"
          description="Connect bank and credit card accounts. UDAs are logical groupings and do not connect through Plaid."
          actions={<PlaidLinkButton />}
        />
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="mb-4">No accounts yet.</p>
          <PlaidLinkButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <PageHeader
        title="Accounts"
        description="Manage connected bank/credit card accounts separately from logical User Defined Accounts."
        actions={<PlaidLinkButton />}
      />

      {/* Tax Entities with Accounts */}
      <div className="space-y-8">
        {taxEntities.map((entity) => {
          const entityAccounts = accountsByEntity.get(entity.id) ?? [];
          const institutionalAccounts = entityAccounts.filter(isInstitutionalAccount);
          const logicalAccounts = entityAccounts.filter((account) => !isInstitutionalAccount(account));
          return (
            <div key={entity.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{entity.name}</h2>
                <Badge variant="secondary">{ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}</Badge>
              </div>              
              {entityAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts assigned to this Tax Entity.</p>
              ) : (
                <div className="space-y-4">
                  {institutionalAccounts.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Connected bank & credit card accounts</h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {institutionalAccounts.map((account) => (
                          <AccountCard 
                            key={account.id} 
                            account={account} 
                            plaidItem={getPlaidItem(account.id)}
                            taxEntities={taxEntities}
                            onAssign={handleAssign}
                            onMerge={setMergeTarget}
                            onRename={handleRename}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {logicalAccounts.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Logical User Defined Accounts</h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {logicalAccounts.map((account) => (
                          <AccountCard 
                            key={account.id} 
                            account={account} 
                            plaidItem={undefined}
                            taxEntities={taxEntities}
                            onAssign={handleAssign}
                            onMerge={setMergeTarget}
                            onRename={handleRename}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Unassigned Accounts */}
        {unassignedAccounts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-muted-foreground">Unassigned Accounts</h2>
              <Badge variant="outline">Personal</Badge>
            </div>
            <div className="space-y-4">
              {unassignedAccounts.filter(isInstitutionalAccount).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Connected bank & credit card accounts</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {unassignedAccounts.filter(isInstitutionalAccount).map((account) => (
                      <AccountCard 
                        key={account.id} 
                        account={account} 
                        plaidItem={getPlaidItem(account.id)}
                        taxEntities={taxEntities}
                        onAssign={handleAssign}
                        onMerge={setMergeTarget}
                        onRename={handleRename}
                      />
                    ))}
                  </div>
                </div>
              )}
              {unassignedAccounts.filter((account) => !isInstitutionalAccount(account)).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Logical User Defined Accounts</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {unassignedAccounts.filter((account) => !isInstitutionalAccount(account)).map((account) => (
                      <AccountCard 
                        key={account.id} 
                        account={account} 
                        plaidItem={undefined}
                        taxEntities={taxEntities}
                        onAssign={handleAssign}
                        onMerge={setMergeTarget}
                        onRename={handleRename}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {mergeTarget && (
        <MergeAccountModal
          keepAccount={mergeTarget}
          accounts={localAccounts}
          onClose={() => setMergeTarget(null)}
          onMerged={(deletedAccountId, updatedKeepAccount) => {
            setLocalAccounts((current) => current
              .filter((account) => account.id !== deletedAccountId)
              .map((account) => account.id === updatedKeepAccount.id ? { ...account, ...updatedKeepAccount } : account)
            );
            setMergeTarget(null);
          }}
        />
      )}
    </div>
  );
}

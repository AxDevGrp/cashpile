"use client";

import { useState } from "react";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import PlaidLinkButton from "@/components/plaid-link-button";
import type { TaxEntity, BooksAccount } from "@/modules/books/types";
import { assignAccountToTaxEntity } from "@/modules/books/actions/account.actions";

interface PlaidItem {
  id: string;
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

function AccountCard({
  account,
  plaidItem,
  taxEntities,
  onAssign,
}: {
  account: BooksAccount;
  plaidItem?: PlaidItem;
  taxEntities: TaxEntity[];
  onAssign: (accountId: string, taxEntityId: string | null) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  async function handleRefresh() {
    if (!plaidItem) return;
    setSyncing(true);
    await fetch("/api/plaid/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: plaidItem.id }),
    });
    setSyncing(false);
    window.location.reload();
  }

  const assignedEntity = taxEntities.find(e => e.id === account.tax_entity_id);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{account.name}</CardTitle>
            {account.institution_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{account.institution_name}</p>
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
              <PlaidLinkButton taxEntityId={account.tax_entity_id ?? undefined} />
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
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-xs"
              onClick={() => setIsAssigning(!isAssigning)}
            >
              {isAssigning ? "Cancel" : assignedEntity ? "Change" : "Assign"}
            </Button>
          </div>
          
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

export default function AccountsClient({ taxEntities, accounts, plaidItems }: Props) {
  const [localAccounts, setLocalAccounts] = useState(accounts);

  const getPlaidItem = (accountId: string) => 
    plaidItems.find((p) => p.tax_entity_id === localAccounts.find(a => a.id === accountId)?.tax_entity_id);

  async function handleAssign(accountId: string, taxEntityId: string | null) {
    try {
      await assignAccountToTaxEntity(accountId, taxEntityId);
      // Update local state
      setLocalAccounts(prev => 
        prev.map(a => a.id === accountId ? { ...a, tax_entity_id: taxEntityId } : a)
      );
    } catch (err) {
      console.error("Failed to assign account:", err);
      alert("Failed to assign account to Tax Entity");
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
        <PageHeader
          title="Accounts"
          description="Connect your financial accounts and assign them to Tax Entities"
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
      <PageHeader
        title="Accounts"
        description="Manage your financial accounts and their Tax Entity assignments"
        actions={<PlaidLinkButton />}
      />

      {/* Tax Entities with Accounts */}
      <div className="space-y-8">
        {taxEntities.map((entity) => {
          const entityAccounts = accountsByEntity.get(entity.id) ?? [];
          return (
            <div key={entity.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{entity.name}</h2>
                <Badge variant="secondary">{ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}</Badge>
              </div>              
              {entityAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts assigned to this Tax Entity.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {entityAccounts.map((account) => (
                    <AccountCard 
                      key={account.id} 
                      account={account} 
                      plaidItem={getPlaidItem(account.id)}
                      taxEntities={taxEntities}
                      onAssign={handleAssign}
                    />
                  ))}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {unassignedAccounts.map((account) => (
                <AccountCard 
                  key={account.id} 
                  account={account} 
                  plaidItem={getPlaidItem(account.id)}
                  taxEntities={taxEntities}
                  onAssign={handleAssign}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import PlaidLinkButton from "@/components/plaid-link-button";
import type { BooksEntity, BooksUda, BooksAccount } from "@/modules/books/types";

interface PlaidItem {
  id: string;
  uda_id: string | null;
  institution_name: string | null;
  status: string;
  last_synced_at: string | null;
}

interface Props {
  entities: BooksEntity[];
  udas: (BooksUda & { books_financial_accounts?: BooksAccount[] })[];
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

function UdaCard({
  uda,
  plaidItem,
}: {
  uda: BooksUda & { books_financial_accounts?: BooksAccount[] };
  plaidItem?: PlaidItem;
}) {
  const [syncing, setSyncing] = useState(false);

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{uda.name}</CardTitle>
            {uda.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{uda.description}</p>
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
              <PlaidLinkButton udaId={uda.id} />
            )}
          </div>
        </div>
        {plaidItem?.last_synced_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Last synced {new Date(plaidItem.last_synced_at).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {(uda.books_financial_accounts ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No financial accounts</p>
        ) : (
          <ul className="space-y-1">
            {(uda.books_financial_accounts ?? []).map((acct) => (
              <li key={acct.id} className="flex justify-between text-sm">
                <span>{acct.name}</span>
                <div className="flex items-center gap-2">
                  {(acct as any).current_balance != null && (
                    <span className="text-muted-foreground text-xs">
                      ${Number((acct as any).current_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {ACCOUNT_TYPE_LABELS[acct.account_type] ?? acct.account_type}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountsClient({ entities, udas, plaidItems }: Props) {
  const getPlaidItem = (udaId: string) => plaidItems.find((p) => p.uda_id === udaId);

  if (entities.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="Accounts"
          description="Connect your financial accounts or manage account groups"
          actions={<PlaidLinkButton />}
        />
        {udas.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p className="mb-4">No accounts yet.</p>
            <PlaidLinkButton />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {udas.map((uda) => (
              <UdaCard key={uda.id} uda={uda} plaidItem={getPlaidItem(uda.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Accounts"
        description="Manage your entities and financial accounts"
        actions={<PlaidLinkButton />}
      />
      <div className="space-y-8">
        {entities.map((entity) => {
          const entityUdas = udas.filter((u) => (u as any).entity_id === entity.id);
          return (
            <div key={entity.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{entity.name}</h2>
                <Badge variant="secondary">{entity.type}</Badge>
              </div>
              {entityUdas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts for this entity.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {entityUdas.map((uda) => (
                    <UdaCard key={uda.id} uda={uda} plaidItem={getPlaidItem(uda.id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Unassigned UDAs */}
        {udas.filter((u) => !(u as any).entity_id).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground">Unassigned</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {udas.filter((u) => !(u as any).entity_id).map((uda) => (
                <UdaCard key={uda.id} uda={uda} plaidItem={getPlaidItem(uda.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

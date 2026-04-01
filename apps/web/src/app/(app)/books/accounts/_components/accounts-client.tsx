"use client";

import Link from "next/link";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import type { BooksEntity, BooksUda, BooksAccount } from "@/modules/books/types";

interface Props {
  entities: BooksEntity[];
  udas: (BooksUda & { books_financial_accounts?: BooksAccount[] })[];
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  investment: "Investment",
  other: "Other",
};

function UdaCard({ uda }: { uda: BooksUda & { books_financial_accounts?: BooksAccount[] } }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{uda.name}</CardTitle>
        {uda.description && (
          <p className="text-xs text-muted-foreground">{uda.description}</p>
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
                <Badge variant="outline" className="text-xs">
                  {ACCOUNT_TYPE_LABELS[acct.account_type] ?? acct.account_type}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountsClient({ entities, udas }: Props) {
  // No entities — show all UDAs flat (imported from Stacks or manually created)
  if (entities.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accounts"
          description="Your financial account groups"
          actions={
            <Link href="/books/accounts/new">
              <Button>New Account</Button>
            </Link>
          }
        />
        {udas.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p>No accounts yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {udas.map((uda) => <UdaCard key={uda.id} uda={uda} />)}
          </div>
        )}
      </div>
    );
  }

  // Entities exist — group UDAs by entity
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage your entities and financial accounts"
        actions={
          <Link href="/books/accounts/new">
            <Button>New Account</Button>
          </Link>
        }
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
                  {entityUdas.map((uda) => <UdaCard key={uda.id} uda={uda} />)}
                </div>
              )}
            </div>
          );
        })}

        {/* UDAs not linked to any entity */}
        {udas.filter((u) => !(u as any).entity_id || !entities.find((e) => e.id === (u as any).entity_id)).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground">Unassigned</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {udas
                .filter((u) => !(u as any).entity_id || !entities.find((e) => e.id === (u as any).entity_id))
                .map((uda) => <UdaCard key={uda.id} uda={uda} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

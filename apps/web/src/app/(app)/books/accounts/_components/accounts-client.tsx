"use client";

import Link from "next/link";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import type { BooksEntity, BooksUda, BooksAccount } from "@/modules/books/types";

interface Props {
  entities: BooksEntity[];
  udas: (BooksUda & { books_accounts?: BooksAccount[] })[];
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  llc: "LLC",
  s_corp: "S Corp",
  c_corp: "C Corp",
  partnership: "Partnership",
  sole_prop: "Sole Prop",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  investment: "Investment",
  other: "Other",
};

export default function AccountsClient({ entities, udas }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" description="Manage your entities, rental units, and financial accounts" actions={
        <Link href="/books/accounts/new">
          <Button>New Account</Button>
        </Link>
      } />

      {entities.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p>No entities yet.</p>
          <Link href="/books/entities/new">
            <Button variant="outline" className="mt-3">Create your first entity</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {entities.map((entity) => {
            const entityUdas = udas.filter((u) => u.entity_id === entity.id);
            return (
              <div key={entity.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{entity.name}</h2>
                  <Badge variant="secondary">{ENTITY_TYPE_LABELS[entity.type] ?? entity.type}</Badge>
                </div>

                {entityUdas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accounts for this entity.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {entityUdas.map((uda) => (
                      <Card key={uda.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{uda.name}</CardTitle>
                          {uda.description && (
                            <p className="text-xs text-muted-foreground">{uda.description}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          {(uda.books_accounts ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No financial accounts</p>
                          ) : (
                            <ul className="space-y-1">
                              {(uda.books_accounts ?? []).map((acct) => (
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
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

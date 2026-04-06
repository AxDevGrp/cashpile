"use client";

import Link from "next/link";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent, CardDescription } from "@cashpile/ui";
import type { TaxEntity } from "@/modules/books/types";

interface Props {
  taxEntities: TaxEntity[];
  categoryCounts: Record<string, number>;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  llc: "LLC",
  s_corp: "S-Corp",
  c_corp: "C-Corp",
  partnership: "Partnership",
  sole_proprietorship: "Sole Proprietorship",
  rental_property: "Rental Property",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  llc: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  s_corp: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  c_corp: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  partnership: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  sole_proprietorship: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  rental_property: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function EntitiesClient({ taxEntities, categoryCounts }: Props) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Tax Entities" description="Manage your business entities for tax reporting" actions={
        <Link href="/books/entities/new">
          <Button>New Tax Entity</Button>
        </Link>
      } />

      {taxEntities.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">No Tax Entities yet</p>
          <p className="text-sm mt-1">Create a Tax Entity to start organizing your business accounts and transactions.</p>
          <Link href="/books/entities/new">
            <Button className="mt-4">Create Tax Entity</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {taxEntities.map((entity) => (
            <Card key={entity.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{entity.name}</CardTitle>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_TYPE_COLORS[entity.entity_type] ?? "bg-gray-100 text-gray-800"}`}>
                    {ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}
                  </span>
                </div>
                {entity.tax_id && (
                  <CardDescription className="text-xs">EIN/TIN: {entity.tax_id}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{categoryCounts[entity.id] ?? 0} categories</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={`/books/transactions?taxEntityId=${entity.id}`}>
                    <Button variant="outline" size="sm">Transactions</Button>
                  </Link>
                  <Link href={`/books/tax`}>
                    <Button variant="outline" size="sm">Tax Report</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

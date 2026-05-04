import { listTransactions } from "@/modules/books/actions/transaction.actions";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import TransactionsClient from "./_components/transactions-client";

export const metadata = { title: "Transactions — Books | Cashpile" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { taxEntityId?: string; accountId?: string; categoryId?: string; from?: string; to?: string };
}) {
  const [transactionsResult, taxEntitiesResult, categoriesResult] = await Promise.all([
    listTransactions({
      taxEntityId: searchParams.taxEntityId,
      accountId: searchParams.accountId,
      categoryId: searchParams.categoryId,
      dateFrom: searchParams.from,
      dateTo: searchParams.to,
      limit: 100,
    }).catch((error) => {
      console.error("[books/transactions] failed to load transactions:", error);
      return { data: [], count: 0, loadError: "Unable to load transactions." };
    }),
    listTaxEntities().catch((error) => {
      console.error("[books/transactions] failed to load tax entities:", error);
      return [];
    }),
    listCategories().catch((error) => {
      console.error("[books/transactions] failed to load categories:", error);
      return [];
    }),
  ]);

  return (
    <TransactionsClient
      transactions={transactionsResult.data}
      totalCount={transactionsResult.count}
      entities={taxEntitiesResult}
      categories={categoriesResult}
      udas={[]}
      filters={searchParams}
      loadError={"loadError" in transactionsResult ? transactionsResult.loadError : undefined}
    />
  );
}

import { listTransactions } from "@/modules/books/actions/transaction.actions";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import TransactionsClient from "./_components/transactions-client";

export const metadata = { title: "Transactions — Books | Cashpile" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { taxEntityId?: string; accountId?: string; categoryId?: string; from?: string; to?: string };
}) {
  const [{ data: transactions, count }, taxEntities, categories, accounts] = await Promise.all([
    listTransactions({
      taxEntityId: searchParams.taxEntityId,
      accountId: searchParams.accountId,
      categoryId: searchParams.categoryId,
      dateFrom: searchParams.from,
      dateTo: searchParams.to,
      limit: 100,
    }),
    listTaxEntities(),
    listCategories(),
    listAccounts(),
  ]);

  return (
    <TransactionsClient
      transactions={transactions}
      totalCount={count}
      entities={taxEntities}
      categories={categories}
      udas={[]}
      filters={searchParams}
    />
  );
}

import { listTransactions } from "@/modules/books/actions/transaction.actions";
import { listEntities } from "@/modules/books/actions/entity.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import { listUdas } from "@/modules/books/actions/account.actions";
import TransactionsClient from "./_components/transactions-client";

export const metadata = { title: "Transactions — Books | Cashpile" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { udaId?: string; accountId?: string; categoryId?: string; from?: string; to?: string };
}) {
  const [{ data: transactions, count }, entities, categories, udas] = await Promise.all([
    listTransactions({
      udaId: searchParams.udaId,
      accountId: searchParams.accountId,
      categoryId: searchParams.categoryId,
      dateFrom: searchParams.from,
      dateTo: searchParams.to,
      limit: 100,
    }),
    listEntities(),
    listCategories(),
    listUdas(),
  ]);

  return (
    <TransactionsClient
      transactions={transactions}
      totalCount={count}
      entities={entities}
      categories={categories}
      udas={udas}
      filters={searchParams}
    />
  );
}

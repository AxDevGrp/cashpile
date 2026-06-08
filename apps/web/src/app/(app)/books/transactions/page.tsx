import TransactionsClient from "./_components/transactions-client";
import { listAccounts, listUdas } from "@/modules/books/actions/account.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";

export const metadata = { title: "Transactions — Books | Cashpile" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { taxEntityId?: string; accountId?: string; categoryId?: string; from?: string; to?: string; search?: string };
}) {
  const [accounts, categories, entities, udas] = await Promise.all([
    listAccounts(),
    listCategories(),
    listTaxEntities(),
    listUdas(),
  ]);

  return (
    <TransactionsClient
      transactions={[]}
      totalCount={0}
      entities={entities}
      categories={categories}
      udas={udas}
      accounts={accounts}
      filters={searchParams}
      title="Transactions"
      description="Choose an account to work in its transaction ledger, or search globally across all accounts."
      requireQuery
      emptyQueryMessage="Choose an account to view its transactions, or enter a search term/filter to search globally."
    />
  );
}

import TransactionsClient from "./_components/transactions-client";

export const metadata = { title: "Transactions — Books | Cashpile" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { taxEntityId?: string; accountId?: string; categoryId?: string; from?: string; to?: string };
}) {
  return (
    <TransactionsClient
      transactions={[]}
      totalCount={0}
      entities={[]}
      categories={[]}
      udas={[]}
      filters={searchParams}
    />
  );
}

import TransactionsClient from "./_components/transactions-client";
import { ConsumerActivityClient } from "./_components/consumer-activity-client";
import { listTransactions } from "@/modules/books/actions/transaction.actions";
import { listAccounts, listUdas } from "@/modules/books/actions/account.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { getTaxModuleAccess } from "@/lib/tax-access";
import { getConsumerExperience } from "@/lib/consumer-experience";
import { WriteWorkflowV2 } from "../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Transactions — Books | Cashpile" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { taxEntityId?: string; accountId?: string; categoryId?: string; from?: string; to?: string; search?: string; filter?: "uncategorized" | "categorized"; view?: string };
}) {
  const { userId, enabled } = await getConsumerExperience();

  // Eligible consumers start with recent data immediately; ?view=advanced keeps
  // the existing advanced ledger.
  if (userId && enabled && searchParams?.view !== "advanced") {
    const [initial, accounts, categories] = await Promise.all([
      listTransactions({ limit: 50, offset: 0 }),
      listAccounts(),
      listCategories(),
    ]);
    return (
      <ConsumerActivityClient
        initial={{ data: initial.data as never[], count: initial.count }}
        accounts={(accounts as Array<{ id: string; name: string }>).map((a) => ({ id: a.id, name: a.name }))}
        categories={categories.map((c) => ({ id: Number(c.id), name: c.name }))}
      />
    );
  }

  const { canUseTax } = await getTaxModuleAccess();
  const [accounts, categories, entities, udas] = await Promise.all([
    listAccounts(),
    listCategories(),
    listTaxEntities(),
    listUdas(),
  ]);

  const content = (
    <TransactionsClient
      transactions={[]}
      totalCount={0}
      entities={canUseTax ? entities : []}
      categories={categories}
      udas={udas}
      accounts={accounts}
      filters={canUseTax ? searchParams : { ...searchParams, taxEntityId: undefined }}
      title="Transactions"
      description="Choose an account to work in its transaction ledger, or search globally across all accounts."
      requireQuery
      showTaxModule={canUseTax}
      emptyQueryMessage="Choose an account to view its transactions, or enter a search term/filter to search globally."
    />
  );
  return isUiV2Enabled() ? <WriteWorkflowV2 id="transactions">{content}</WriteWorkflowV2> : content;
}

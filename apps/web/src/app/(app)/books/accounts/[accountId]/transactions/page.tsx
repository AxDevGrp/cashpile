import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@cashpile/db";
import { listAccounts, listUdas } from "@/modules/books/actions/account.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listTransactions } from "@/modules/books/actions/transaction.actions";
import TransactionsClient from "../../../transactions/_components/transactions-client";

export const metadata = { title: "Account Transactions — Books | Cashpile" };

function accountLabel(account: { name: string; institution_name?: string | null; institution?: string | null; last_four_digits?: string | null }) {
  const institution = account.institution_name ?? account.institution;
  const suffix = account.last_four_digits ? ` - *${account.last_four_digits}` : "";
  return institution ? `${account.name} (${institution}${suffix})` : account.name;
}

async function getAccount(accountId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function AccountTransactionsPage({
  params,
  searchParams,
}: {
  params: { accountId: string };
  searchParams: { categoryId?: string; from?: string; to?: string; offset?: string; search?: string };
}) {
  const account = await getAccount(params.accountId);
  if (!account) notFound();

  const filters = {
    ...searchParams,
    accountId: params.accountId,
  };

  const offset = searchParams.offset ? Number(searchParams.offset) : 0;

  const [{ data: transactions, count }, entities, categories, udas] = await Promise.all([
    listTransactions({ ...filters, limit: 100, offset: Number.isFinite(offset) ? offset : 0 }),
    listTaxEntities(),
    listCategories(),
    listUdas(),
  ]);

  const label = accountLabel(account);

  return (
    <TransactionsClient
      transactions={transactions}
      totalCount={count}
      entities={entities}
      categories={categories}
      udas={udas}
      filters={filters}
      title={`Transactions — ${account.name}`}
      descriptionContext={`in ${label}`}
      backHref="/books/accounts"
      lockedAccountId={params.accountId}
    />
  );
}

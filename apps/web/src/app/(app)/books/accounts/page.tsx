import { createServerSupabaseClient } from "@cashpile/db";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import { getConsumerExperience } from "@/lib/consumer-experience";
import AccountsClient from "./_components/accounts-client";
import { ConsumerAccountsClient } from "./_components/consumer-accounts-client";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Accounts — Books | Cashpile" };

async function listPlaidItems() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await (supabase as any)
    .from("books_plaid_items")
    .select("id, item_id, uda_id, tax_entity_id, institution_name, status, last_synced_at")
    .eq("user_id", user.id);
  return data ?? [];
}

async function loadJobCounts(supabase: any, userId: string) {
  const { data } = await supabase
    .from("books_interpretation_jobs")
    .select("status")
    .eq("user_id", userId);
  const counts = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const row of data ?? []) {
    if (row.status in counts) counts[row.status as keyof typeof counts] += 1;
  }
  return counts;
}

export default async function AccountsPage() {
  const { userId, enabled } = await getConsumerExperience();

  if (userId && enabled) {
    const supabase = await createServerSupabaseClient();
    const [{ data: accountRows }, plaidItems, jobCounts] = await Promise.all([
      (supabase as any)
        .from("books_financial_accounts")
        .select("id, name, account_type, institution_name, current_balance, currency_code, cashflow_include, cashflow_role, plaid_item_id, is_active, is_emergency, tax_entity_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      listPlaidItems(),
      loadJobCounts(supabase, userId),
    ]);
    return (
      <ConsumerAccountsClient
        accounts={accountRows ?? []}
        plaidItems={plaidItems as never[]}
        jobCounts={jobCounts}
      />
    );
  }

  const [taxEntities, accounts, plaidItems] = await Promise.all([
    listTaxEntities(),
    listAccounts(),
    listPlaidItems(),
  ]);

  return (
    <AccountsClient 
      taxEntities={taxEntities} 
      accounts={accounts} 
      plaidItems={plaidItems} 
      uiV2={isUiV2Enabled()}
    />
  );
}

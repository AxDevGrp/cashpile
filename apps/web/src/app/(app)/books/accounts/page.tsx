import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import { createServerSupabaseClient } from "@cashpile/db";
import AccountsClient from "./_components/accounts-client";

export const metadata = { title: "Accounts — Books | Cashpile" };

async function listPlaidItems() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await (supabase as any)
    .from("books_plaid_items")
    .select("id, uda_id, tax_entity_id, institution_name, status, last_synced_at")
    .eq("user_id", user.id);
  return data ?? [];
}

export default async function AccountsPage() {
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
    />
  );
}

import { listEntities } from "@/modules/books/actions/entity.actions";
import { listUdas } from "@/modules/books/actions/account.actions";
import { createServerSupabaseClient } from "@cashpile/db";
import AccountsClient from "./_components/accounts-client";

export const metadata = { title: "Accounts — Books | Cashpile" };

async function listPlaidItems() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await (supabase as any)
    .from("books_plaid_items")
    .select("id, uda_id, institution_name, status, last_synced_at")
    .eq("user_id", user.id);
  return data ?? [];
}

export default async function AccountsPage() {
  const [entities, allUdas, plaidItems] = await Promise.all([
    listEntities(),
    listUdas(),
    listPlaidItems(),
  ]);

  return <AccountsClient entities={entities} udas={allUdas} plaidItems={plaidItems} />;
}

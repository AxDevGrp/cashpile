import { createServerSupabaseClient } from "@cashpile/db";
import { TaxClient } from "./_components/tax-client";
import { getTaxSummaryForEntities } from "@/modules/books/actions/tax.actions";
import { backfillAssignedAccountTaxViews } from "@/modules/books/actions/account.actions";
import type { BooksAccount, TaxEntity } from "@/modules/books/types";

export default async function TaxPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: taxEntities }, { data: accounts }] = await Promise.all([
    (supabase as any)
      .from("books_business_entities")
      .select("id, name, entity_type, tax_id")
      .eq("user_id", user.id)
      .order("name"),
    (supabase as any)
      .from("books_financial_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  await backfillAssignedAccountTaxViews();

  const year = new Date().getFullYear();
  const entityList = (taxEntities ?? []) as TaxEntity[];
  const accountList = (accounts ?? []) as BooksAccount[];
  const summaries = await getTaxSummaryForEntities(entityList.map((e) => e.id), year);

  return <TaxClient taxEntities={entityList} accounts={accountList} summaries={summaries} defaultYear={year} />;
}

import { createServerSupabaseClient } from "@cashpile/db";
import { TaxClient } from "./_components/tax-client";
import { getTaxSummaryForEntities } from "@/modules/books/actions/tax.actions";
import type { TaxEntity } from "@/modules/books/types";

export default async function TaxPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: taxEntities } = await (supabase as any)
    .from("books_business_entities")
    .select("id, name, entity_type, tax_id")
    .eq("user_id", user.id)
    .order("name");

  const year = new Date().getFullYear();
  const entityList = (taxEntities ?? []) as TaxEntity[];
  const summaries = await getTaxSummaryForEntities(entityList.map((e) => e.id), year);

  return <TaxClient taxEntities={entityList} summaries={summaries} defaultYear={year} />;
}

import { createServerSupabaseClient } from "@cashpile/db";
import { TaxClient } from "./_components/tax-client";
import { getTaxSummaryForUdas } from "@/modules/books/actions/tax.actions";

export default async function TaxPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: udas } = await (supabase as any)
    .from("books_udas")
    .select("id, name, description")
    .eq("user_id", user.id)
    .order("name");

  const year = new Date().getFullYear();
  const udaList = (udas ?? []) as Array<{ id: string; name: string; description: string | null }>;
  const summaries = await getTaxSummaryForUdas(udaList.map((u) => u.id), year);

  return <TaxClient udas={udaList} summaries={summaries} defaultYear={year} />;
}

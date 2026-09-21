import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@cashpile/db";
import { TaxClient } from "./_components/tax-client";
import { getTaxSummaryForEntities } from "@/modules/books/actions/tax.actions";
import { backfillAssignedAccountTaxViews } from "@/modules/books/actions/account.actions";
import { listAiInstructionOptions } from "@/modules/books/actions/ai-review.actions";
import type { BooksAccount, TaxEntity } from "@/modules/books/types";
import { canUseTaxModule } from "@/lib/tax-access";
import { ModuleHomeV2 } from "../../_components/module-home-v2";
import { isUiV2Enabled } from "@/components/ui-v2";
import { shouldRenderModuleEntrance } from "@/components/ui-v2/module-home-model";
import { WriteWorkflowV2 } from "../../_components/write-workflow-v2";

export default async function TaxPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!canUseTaxModule(user.id)) notFound();

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
  const [summaries, aiOptions] = await Promise.all([
    getTaxSummaryForEntities(entityList.map((e) => e.id), year),
    listAiInstructionOptions(),
  ]);

  const resolvedSearchParams = await searchParams;
  const uiV2 = isUiV2Enabled();
  const insight = entityList.length === 0
    ? { id: "entities", severity: "attention" as const, title: "Add a tax entity", detail: "Entities organize tax-ready records.", actionLabel: "Add entities" }
    : { id: "entities", severity: "info" as const, title: `${entityList.length.toLocaleString()} tax entit${entityList.length === 1 ? "y is" : "ies are"} ready`, detail: "Open the workspace to review records." };
  if (shouldRenderModuleEntrance(uiV2, resolvedSearchParams?.view)) return <ModuleHomeV2 id="tax" insight={insight} actionHref={entityList.length === 0 ? "/books/entities" : "/books/tax?view=details"} />;

  const content = <TaxClient taxEntities={entityList} accounts={accountList} summaries={summaries} defaultYear={year} aiOptions={aiOptions} />;
  return uiV2 ? <WriteWorkflowV2 id="tax-details">{content}</WriteWorkflowV2> : content;
}

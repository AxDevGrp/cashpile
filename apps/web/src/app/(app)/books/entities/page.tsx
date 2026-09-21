import { notFound } from "next/navigation";
import { getTaxModuleAccess } from "@/lib/tax-access";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import EntitiesClient from "./_components/entities-client";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Tax Entities — Books | Cashpile" };

export default async function EntitiesPage() {
  const { canUseTax } = await getTaxModuleAccess();
  if (!canUseTax) notFound();

  const taxEntities = await listTaxEntities();
  const categoryCounts = await Promise.all(
    taxEntities.map(async (e) => {
      const cats = await listCategories(e.id);
      return { entityId: e.id, count: cats.length };
    })
  );
  const countMap = Object.fromEntries(categoryCounts.map((c) => [c.entityId, c.count]));

  return <EntitiesClient taxEntities={taxEntities} categoryCounts={countMap} uiV2={isUiV2Enabled()} />;
}

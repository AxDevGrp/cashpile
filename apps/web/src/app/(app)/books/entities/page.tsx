import { listEntities } from "@/modules/books/actions/entity.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import EntitiesClient from "./_components/entities-client";

export const metadata = { title: "Entities — Books | Cashpile" };

export default async function EntitiesPage() {
  const entities = await listEntities();
  const categoryCounts = await Promise.all(
    entities.map(async (e) => {
      const cats = await listCategories(e.id);
      return { entityId: e.id, count: cats.length };
    })
  );
  const countMap = Object.fromEntries(categoryCounts.map((c) => [c.entityId, c.count]));

  return <EntitiesClient entities={entities} categoryCounts={countMap} />;
}

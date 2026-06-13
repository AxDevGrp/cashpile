import { ensureDefaultBookCategories, listCategories } from "@/modules/books/actions/category.actions";
import { listCategoryRules, seedSystemCategoryRules } from "@/modules/books/actions/category-rule.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import CategoryRulesClient from "./_components/category-rules-client";

export const metadata = { title: "Category Rules — Books | Cashpile" };

export default async function CategoryRulesPage() {
  await ensureDefaultBookCategories().catch(() => null);
  await seedSystemCategoryRules().catch(() => null);

  const [rules, categories, accounts] = await Promise.all([
    listCategoryRules().catch(() => []),
    listCategories().catch(() => []),
    listAccounts().catch(() => []),
  ]);

  return <CategoryRulesClient initialRules={rules} categories={categories} accounts={accounts} />;
}

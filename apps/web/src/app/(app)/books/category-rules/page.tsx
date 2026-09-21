import { ensureDefaultBookCategories, listCategories } from "@/modules/books/actions/category.actions";
import { listCategoryRules, seedSystemCategoryRules } from "@/modules/books/actions/category-rule.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import CategoryRulesClient from "./_components/category-rules-client";
import { WriteWorkflowV2 } from "../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Category Rules — Books | Cashpile" };

export default async function CategoryRulesPage() {
  await ensureDefaultBookCategories().catch(() => null);
  await seedSystemCategoryRules().catch(() => null);

  const [rules, categories, accounts] = await Promise.all([
    listCategoryRules().catch(() => []),
    listCategories().catch(() => []),
    listAccounts().catch(() => []),
  ]);

  const content = <CategoryRulesClient initialRules={rules} categories={categories} accounts={accounts} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="category-rules">{content}</WriteWorkflowV2> : content;
}

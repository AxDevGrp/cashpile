import { notFound } from "next/navigation";
import { getTaxModuleAccess } from "@/lib/tax-access";
import NewEntityForm from "./_components/new-entity-form";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "New Entity — Books | Cashpile" };

export default async function NewEntityPage() {
  const { canUseTax } = await getTaxModuleAccess();
  if (!canUseTax) notFound();

  const content = <NewEntityForm />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="entity-new">{content}</WriteWorkflowV2> : content;
}

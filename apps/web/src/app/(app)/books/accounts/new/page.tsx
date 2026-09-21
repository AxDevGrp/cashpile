import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import NewAccountForm from "./_components/new-account-form";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "New Account — Books | Cashpile" };

export default async function NewAccountPage() {
  const taxEntities = await listTaxEntities();
  const content = <NewAccountForm taxEntities={taxEntities} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="account-new">{content}</WriteWorkflowV2> : content;
}

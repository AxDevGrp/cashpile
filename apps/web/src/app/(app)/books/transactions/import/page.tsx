import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import ImportWizard from "./_components/import-wizard";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Import Transactions — Books | Cashpile" };

export default async function ImportPage() {
  const taxEntities = await listTaxEntities();
  const accounts = await listAccounts();

  const content = <ImportWizard entities={taxEntities} initialUdas={[]} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="import">{content}</WriteWorkflowV2> : content;
}

import NewAccountForm from "./_components/new-account-form";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "New Account — Trades | Cashpile" };

export default function NewAccountPage() {
  const content = <NewAccountForm />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="trade-account-new">{content}</WriteWorkflowV2> : content;
}

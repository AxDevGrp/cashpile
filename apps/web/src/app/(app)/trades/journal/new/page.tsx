import { listPropAccounts } from "@/modules/trades/actions/account.actions";
import NewTradeForm from "./_components/new-trade-form";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "New Trade — Trades | Cashpile" };

export default async function NewTradePage() {
  const accounts = await listPropAccounts();
  const content = <NewTradeForm accounts={accounts} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="journal-new">{content}</WriteWorkflowV2> : content;
}

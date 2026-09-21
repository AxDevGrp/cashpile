import { listPropAccounts } from "@/modules/trades/actions/account.actions";
import { createServerSupabaseClient } from "@cashpile/db";
import { RulesService } from "@/modules/trades/services/rules.service";
import AccountsClient from "./_components/accounts-client";
import { WriteWorkflowV2 } from "../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Accounts — Trades | Cashpile" };

export default async function TradeAccountsPage() {
  const accounts = await listPropAccounts();
  const supabase = await createServerSupabaseClient();
  const rulesService = new RulesService(supabase);

  // Fetch rules status for each account in parallel
  const rulesResults = await Promise.all(
    accounts.map(async (a) => {
      try {
        const result = await rulesService.checkAllRules(a.user_id, a.id);
        return { accountId: a.id, result };
      } catch {
        return { accountId: a.id, result: null };
      }
    })
  );

  const rulesMap = Object.fromEntries(
    rulesResults.map(({ accountId, result }) => [accountId, result])
  );

  const content = <AccountsClient accounts={accounts} rulesMap={rulesMap} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="trade-accounts">{content}</WriteWorkflowV2> : content;
}

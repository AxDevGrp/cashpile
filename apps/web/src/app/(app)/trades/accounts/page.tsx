import { listPropAccounts } from "@/modules/trades/actions/account.actions";
import { createServerSupabaseClient } from "@cashpile/db";
import { RulesService } from "@/modules/trades/services/rules.service";
import AccountsClient from "./_components/accounts-client";

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

  return <AccountsClient accounts={accounts} rulesMap={rulesMap} />;
}

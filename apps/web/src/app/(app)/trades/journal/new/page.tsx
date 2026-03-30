import { listPropAccounts } from "@/modules/trades/actions/account.actions";
import NewTradeForm from "./_components/new-trade-form";

export const metadata = { title: "New Trade — Trades | Cashpile" };

export default async function NewTradePage() {
  const accounts = await listPropAccounts();
  return <NewTradeForm accounts={accounts} />;
}

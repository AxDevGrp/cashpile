import { listTrades } from "@/modules/trades/actions/trade.actions";
import { listPropAccounts } from "@/modules/trades/actions/account.actions";
import JournalClient from "./_components/journal-client";

export const metadata = { title: "Trade Journal — Trades | Cashpile" };

export default async function JournalPage({
  searchParams,
}: {
  searchParams: {
    accountId?: string;
    instrument?: string;
    direction?: string;
    from?: string;
    to?: string;
    open?: string;
  };
}) {
  const accounts = await listPropAccounts();

  const isOpen =
    searchParams.open === "true" ? true : searchParams.open === "false" ? false : undefined;

  const { data: trades, count } = await listTrades({
    accountId: searchParams.accountId,
    instrument: searchParams.instrument,
    from: searchParams.from,
    to: searchParams.to,
    isOpen,
    limit: 100,
  });

  return (
    <JournalClient
      trades={trades}
      totalCount={count}
      accounts={accounts}
      filters={searchParams}
    />
  );
}

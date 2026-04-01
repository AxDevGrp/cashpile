import { listEntities } from "@/modules/books/actions/entity.actions";
import { listUdas } from "@/modules/books/actions/account.actions";
import AccountsClient from "./_components/accounts-client";

export const metadata = { title: "Accounts — Books | Cashpile" };

export default async function AccountsPage() {
  const [entities, allUdas] = await Promise.all([
    listEntities(),
    listUdas(), // fetch all UDAs for the user, no entity filter
  ]);

  return <AccountsClient entities={entities} udas={allUdas} />;
}

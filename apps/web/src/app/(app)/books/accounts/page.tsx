import { listEntities } from "@/modules/books/actions/entity.actions";
import { listUdas } from "@/modules/books/actions/account.actions";
import AccountsClient from "./_components/accounts-client";

export const metadata = { title: "Accounts — Books | Cashpile" };

export default async function AccountsPage() {
  const entities = await listEntities();
  const udas = await Promise.all(entities.map((e) => listUdas(e.id)));
  const allUdas = udas.flat();

  return <AccountsClient entities={entities} udas={allUdas} />;
}

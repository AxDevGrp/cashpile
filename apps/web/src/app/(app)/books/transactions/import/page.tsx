import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { listAccounts } from "@/modules/books/actions/account.actions";
import ImportWizard from "./_components/import-wizard";

export const metadata = { title: "Import Transactions — Books | Cashpile" };

export default async function ImportPage() {
  const taxEntities = await listTaxEntities();
  const accounts = await listAccounts();

  return <ImportWizard taxEntities={taxEntities} initialAccounts={accounts} />;
}

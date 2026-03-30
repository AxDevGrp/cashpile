import { listEntities } from "@/modules/books/actions/entity.actions";
import { listUdas } from "@/modules/books/actions/account.actions";
import ImportWizard from "./_components/import-wizard";

export const metadata = { title: "Import Transactions — Books | Cashpile" };

export default async function ImportPage() {
  const entities = await listEntities();
  const udas = entities.length > 0 ? await listUdas(entities[0]?.id) : [];

  return <ImportWizard entities={entities} initialUdas={udas} />;
}

import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import NewAccountForm from "./_components/new-account-form";

export const metadata = { title: "New Account — Books | Cashpile" };

export default async function NewAccountPage() {
  const taxEntities = await listTaxEntities();
  return <NewAccountForm taxEntities={taxEntities} />;
}

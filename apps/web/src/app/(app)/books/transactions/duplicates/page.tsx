import DuplicateReviewClient from "./_components/duplicate-review-client";
import { listDuplicateReviewGroups } from "@/modules/books/actions/duplicate.actions";

export const metadata = { title: "Duplicate Review — Books | Cashpile" };

export default async function DuplicateReviewPage() {
  const groups = await listDuplicateReviewGroups();
  return <DuplicateReviewClient groups={groups} />;
}

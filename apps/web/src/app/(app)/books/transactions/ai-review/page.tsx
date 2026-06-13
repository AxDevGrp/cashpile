import { listAiReviewSuggestions } from "@/modules/books/actions/ai-review.actions";
import AiReviewClient from "./_components/ai-review-client";

export const metadata = { title: "AI Review — Transactions | Cashpile" };

export default async function AiReviewPage() {
  const data = await listAiReviewSuggestions(40);
  return <AiReviewClient initialData={data} />;
}

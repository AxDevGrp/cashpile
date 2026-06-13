import { listAiReviewSuggestions } from "@/modules/books/actions/ai-review.actions";
import AiReviewClient from "./_components/ai-review-client";

export const metadata = { title: "AI Review — Transactions | Cashpile" };

export default async function AiReviewPage({ searchParams }: { searchParams?: { accountId?: string } }) {
  const data = await listAiReviewSuggestions(40, searchParams?.accountId ?? null);
  return <AiReviewClient initialData={data} />;
}

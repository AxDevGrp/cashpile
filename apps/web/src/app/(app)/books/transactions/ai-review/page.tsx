import { listAiReviewSuggestions } from "@/modules/books/actions/ai-review.actions";
import AiReviewClient from "./_components/ai-review-client";

export const metadata = { title: "AI Review — Transactions | Cashpile" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AiReviewPage({ searchParams }: { searchParams?: { accountId?: string; limit?: string } }) {
  const requestedLimit = Number(searchParams?.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 40), 500) : 100;
  const data = await listAiReviewSuggestions(limit, searchParams?.accountId ?? null);
  return <AiReviewClient initialData={data} />;
}

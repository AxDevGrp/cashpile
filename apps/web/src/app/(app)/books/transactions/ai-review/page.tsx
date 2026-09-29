import { createServerSupabaseClient } from "@cashpile/db";
import { listAiReviewSuggestions } from "@/modules/books/actions/ai-review.actions";
import { listConsumerReview } from "@/modules/books/services/consumer-review";
import { getConsumerExperience } from "@/lib/consumer-experience";
import AiReviewClient from "./_components/ai-review-client";
import { ConsumerReviewClient } from "./_components/consumer-review-client";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "AI Review — Transactions | Cashpile" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AiReviewPage({
  searchParams,
}: {
  searchParams?: { accountId?: string; limit?: string; view?: string };
}) {
  const { userId, enabled } = await getConsumerExperience();

  // Eligible consumers get the clarification queue; ?view=advanced keeps the
  // existing advanced review. No old AI-generating list call on initial render.
  if (userId && enabled && searchParams?.view !== "advanced") {
    const supabase = await createServerSupabaseClient();
    const page = await listConsumerReview(supabase as any, userId, { limit: 20 });
    return <ConsumerReviewClient initial={page} userId={userId} />;
  }

  const requestedLimit = Number(searchParams?.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 40), 500) : 100;
  const data = await listAiReviewSuggestions(limit, searchParams?.accountId ?? null);
  const content = <AiReviewClient initialData={data} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="ai-review">{content}</WriteWorkflowV2> : content;
}

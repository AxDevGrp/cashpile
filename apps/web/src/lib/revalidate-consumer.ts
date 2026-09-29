import { revalidatePath } from "next/cache";

/** The seven exact paths affected by consumer review/interpretation changes. */
export const CONSUMER_REVALIDATE_PATHS = [
  "/cashboard",
  "/cashflow",
  "/cashflow/what-if",
  "/cashflow/recurring",
  "/books/transactions",
  "/books/transactions/ai-review",
  "/books/accounts",
] as const;

export function revalidateConsumerPaths(): void {
  for (const path of CONSUMER_REVALIDATE_PATHS) revalidatePath(path);
}

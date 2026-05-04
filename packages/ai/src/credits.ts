/**
 * AI credit cost calculator.
 *
 * 1 credit = $0.000001 (1 micro-dollar)
 *
 * DeepSeek V3.2 pricing (as of 2025):
 *   Input (cache miss):  $0.28 / 1M tokens → 0.28 credits / token
 *   Input (cache hit):   $0.028 / 1M tokens → 0.028 credits / token
 *   Output:              $0.42 / 1M tokens → 0.42 credits / token
 *
 * We use integer arithmetic to avoid floating-point drift.
 * All values are stored and compared as whole credits (bigint-safe).
 */

const INPUT_CREDITS_PER_TOKEN = 0.28;   // $0.28/1M = 0.28 micro-$ per token
const OUTPUT_CREDITS_PER_TOKEN = 0.42;  // $0.42/1M = 0.42 micro-$ per token

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Calculate the integer credit cost for a completed AI call.
 * Always rounds up (ceiling) to ensure we never under-charge.
 */
export function calculateCreditCost(usage: TokenUsage): number {
  const inputCost = usage.promptTokens * INPUT_CREDITS_PER_TOKEN;
  const outputCost = usage.completionTokens * OUTPUT_CREDITS_PER_TOKEN;
  return Math.ceil(inputCost + outputCost);
}

/**
 * AI credit cost calculator.
 *
 * 1 credit = $0.000001 (1 micro-dollar)
 *
 * gpt-4o pricing (as of 2025):
 *   Input:  $2.50  / 1M tokens  →  2.5  credits / token
 *   Output: $10.00 / 1M tokens  → 10.0  credits / token
 *
 * We use integer arithmetic to avoid floating-point drift.
 * All values are stored and compared as whole credits (bigint-safe).
 */

const INPUT_CREDITS_PER_TOKEN = 2.5;   // $2.50/1M = 2.5 micro-$ per token
const OUTPUT_CREDITS_PER_TOKEN = 10.0;  // $10.00/1M = 10 micro-$ per token

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

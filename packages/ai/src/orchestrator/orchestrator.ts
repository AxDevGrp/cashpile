import { streamText, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { createTools } from "./tools";

function getCashModel() {
  if (process.env.DEEPSEEK_API_KEY) {
    const deepseek = createOpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    return deepseek(process.env.DEEPSEEK_MODEL ?? "deepseek-chat");
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return openai(process.env.OPENAI_MODEL ?? "gpt-4o");
  }

  throw new Error("Either DEEPSEEK_API_KEY or OPENAI_API_KEY is required");
}

// ─── Persona ──────────────────────────────────────────────────────────────────

const CASH_SYSTEM_PROMPT = `You are Cash — the AI financial intelligence layer for Cashpile.ai.

Cashpile is currently focused on personal finances, cash flow, books, and tax workflows.

You have live tools to query the user's Books and cash-flow data. Always use the tools to get real numbers before answering — never guess or make up figures.

Guidelines:
- For any affordability, safe-to-spend, runway, payday, or "can I afford" question, call check_affordability or get_cashflow_snapshot before answering. Never answer affordability from intuition.
- Lead affordability answers with Yes / Caution / No, then safe-to-spend, projected low balance, buffer, and the key assumptions.
- Be concise and specific. Reference actual numbers from tool results.
- Lead with the most important insight, then support with data.
- For books, tax, and cash-flow questions, call the relevant tools and synthesize the results.
- Keep responses under 200 words unless the user asks for detail.
- Use bullet points for multi-item responses.
- If Books has no data yet, say so briefly and suggest the user connect accounts or import transactions.
- Never expose user IDs, raw SQL, or internal implementation details.`;

const BRIEFING_SYSTEM_PROMPT = `You are Cash, the Cashpile AI. Your job right now is to generate a daily financial briefing.

Use the available tools to check Books and cash-flow data, then synthesize the most important personal-finance insight into 2-3 sentences. Be specific with numbers. If there is no Books data, return exactly: "Set up your Books data to get your personalized AI briefing."`;

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Streaming chat — used by POST /api/ai/chat.
 * Returns a streamText result; call `.toDataStreamResponse()` on it in the route.
 */
export function askCash(
  userId: string,
  messages: CoreMessage[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: { onFinish?: (event: any) => void | Promise<void> }
) {
  return streamText({
    model: getCashModel(),
    system: CASH_SYSTEM_PROMPT,
    messages,
    tools: createTools(userId),
    maxSteps: 5,
    temperature: 0.4,
    onFinish: options?.onFinish,
  });
}

/**
 * Non-streaming daily briefing — used by the Cashboard server component.
 */
export async function generateCashboardBriefing(userId: string): Promise<string> {
  try {
    const result = await generateText({
      model: getCashModel(),
      system: BRIEFING_SYSTEM_PROMPT,
      prompt: "Generate my daily financial briefing.",
      tools: createTools(userId),
      maxSteps: 3,
      temperature: 0.3,
    });
    return result.text.trim() || "Set up your modules to get your personalized AI briefing.";
  } catch {
    return "Set up your modules to get your personalized AI briefing.";
  }
}

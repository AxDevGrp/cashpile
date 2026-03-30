import { getOpenAIClient, DEFAULT_MODEL } from "../client";

export interface CrossModuleContext {
  books?: {
    netCashFlowMTD?: number;
    topCategories?: Array<{ name: string; amount: number }>;
    accountBalances?: Array<{ name: string; balance: number }>;
  };
  trades?: {
    activeAccounts?: Array<{
      firmName: string;
      drawdownPct: number;
      maxDrawdownPct: number;
      netPnlMTD: number;
    }>;
    recentInsights?: string[];
  };
  pulse?: {
    activeAlerts?: Array<{ instrument: string; message: string; severity: string }>;
    latestPredictions?: Array<{ instrument: string; direction: string; magnitude: string }>;
  };
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the Cashpile AI assistant — a financial intelligence layer for a platform that combines personal/business accounting (Books), prop firm trade tracking (Trades), and real-time market intelligence (Pulse).

You have access to the user's financial context across all three modules. Be concise, specific, and actionable. Reference the actual numbers from the context when available. Focus on cross-module insights that would be impossible to get from any single tool.

Keep responses under 200 words unless asked for detail. Use bullet points for multi-item responses.`;

export async function* streamAssistantResponse(
  messages: AssistantMessage[],
  context: CrossModuleContext
): AsyncGenerator<string> {
  const client = getOpenAIClient();

  const contextBlock = buildContextBlock(context);
  const systemWithContext = contextBlock
    ? `${SYSTEM_PROMPT}\n\n## Current User Context\n${contextBlock}`
    : SYSTEM_PROMPT;

  const stream = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemWithContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    temperature: 0.4,
    max_tokens: 600,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function generateDailyBriefing(context: CrossModuleContext): Promise<string> {
  const client = getOpenAIClient();

  const contextBlock = buildContextBlock(context);
  if (!contextBlock) return "Connect your modules to get your daily AI briefing.";

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are the Cashpile AI. Generate a concise daily financial briefing in 2-3 sentences covering the most important cross-module insights. Be specific with numbers.",
      },
      {
        role: "user",
        content: `Generate my daily briefing based on this context:\n${contextBlock}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content ?? "Unable to generate briefing at this time.";
}

function buildContextBlock(context: CrossModuleContext): string {
  const parts: string[] = [];

  if (context.books) {
    const b = context.books;
    parts.push(
      `Books: Net cash flow MTD: $${b.netCashFlowMTD?.toFixed(2) ?? "N/A"}` +
        (b.accountBalances?.length
          ? `. Balances: ${b.accountBalances.map((a) => `${a.name}: $${a.balance.toFixed(2)}`).join(", ")}`
          : "")
    );
  }

  if (context.trades) {
    const t = context.trades;
    if (t.activeAccounts?.length) {
      parts.push(
        `Trades: ${t.activeAccounts.map((a) => `${a.firmName} at ${a.drawdownPct.toFixed(2)}% drawdown (max: ${a.maxDrawdownPct}%), P&L MTD: $${a.netPnlMTD.toFixed(2)}`).join("; ")}`
      );
    }
  }

  if (context.pulse) {
    const p = context.pulse;
    if (p.activeAlerts?.length) {
      parts.push(`Pulse alerts: ${p.activeAlerts.map((a) => `${a.instrument}: ${a.message}`).join("; ")}`);
    }
    if (p.latestPredictions?.length) {
      parts.push(`Market predictions: ${p.latestPredictions.map((pred) => `${pred.instrument} ${pred.direction} (${pred.magnitude})`).join(", ")}`);
    }
  }

  return parts.join("\n");
}

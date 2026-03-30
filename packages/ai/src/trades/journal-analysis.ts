import { getOpenAIClient, DEFAULT_MODEL } from "../client";

export interface TradeEntry {
  id: string;
  instrument: string;
  direction: "long" | "short";
  entry_time: string;
  exit_time?: string;
  net_pnl?: number;
  r_multiple?: number;
  setup_tag?: string;
}

export interface JournalInsight {
  type: "pattern" | "risk_alert" | "performance" | "suggestion";
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
}

export async function analyzeTradeJournal(
  trades: TradeEntry[],
  accountDrawdownPct: number,
  maxDrawdownPct: number
): Promise<JournalInsight[]> {
  const insights: JournalInsight[] = [];

  // Rule-based: drawdown alert
  if (accountDrawdownPct >= maxDrawdownPct * 0.8) {
    insights.push({
      type: "risk_alert",
      title: "Approaching Drawdown Limit",
      description: `You are at ${accountDrawdownPct.toFixed(2)}% drawdown — ${(maxDrawdownPct - accountDrawdownPct).toFixed(2)}% from your limit of ${maxDrawdownPct}%.`,
      severity: accountDrawdownPct >= maxDrawdownPct * 0.95 ? "critical" : "warning",
      data: { drawdownPct: accountDrawdownPct, maxDrawdownPct },
    });
  }

  // AI analysis for patterns
  if (trades.length >= 5) {
    try {
      const aiInsights = await generateAIInsights(trades);
      insights.push(...aiInsights);
    } catch {
      // Silent fail — AI insights are additive, not critical
    }
  }

  return insights;
}

async function generateAIInsights(trades: TradeEntry[]): Promise<JournalInsight[]> {
  const client = getOpenAIClient();

  const tradeSummary = trades.slice(-50).map((t) => ({
    instrument: t.instrument,
    direction: t.direction,
    hour: new Date(t.entry_time).getUTCHours(),
    dayOfWeek: new Date(t.entry_time).getUTCDay(),
    pnl: t.net_pnl,
    r: t.r_multiple,
    setup: t.setup_tag,
  }));

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a professional trading coach analyzing a trader's journal. Identify specific, actionable patterns in win/loss data.",
      },
      {
        role: "user",
        content: `Analyze these trades and return 2-3 key insights as JSON array with { type, title, description, severity }:\n${JSON.stringify(tradeSummary)}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.insights ?? [];
}

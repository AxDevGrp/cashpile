/**
 * Formats a financial event into MiroFish seed data format.
 * MiroFish expects seed materials describing the scenario, agents, and prediction target.
 */

export interface FinancialEvent {
  id: string;
  title: string;
  summary: string;
  category: "fed" | "macro" | "geopolitical" | "earnings" | "sector" | "commodities";
  severity: "low" | "medium" | "high" | "critical";
  affected_instruments: string[];
  published_at: string;
  source: string;
}

export interface MiroFishSeed {
  scenario_title: string;
  scenario_description: string;
  seed_materials: string;
  prediction_target: string;
  agent_universe: string;
  simulation_rounds: number;
  metadata: Record<string, unknown>;
}

const INSTRUMENT_DESCRIPTIONS: Record<string, string> = {
  ES: "S&P 500 E-mini Futures",
  NQ: "NASDAQ 100 E-mini Futures",
  YM: "Dow Jones E-mini Futures",
  RTY: "Russell 2000 E-mini Futures",
  CL: "Crude Oil (WTI) Futures",
  GC: "Gold Futures",
  SI: "Silver Futures",
  DXY: "US Dollar Index",
  TLT: "20+ Year Treasury Bond ETF",
  VIX: "CBOE Volatility Index",
  XLK: "Technology Select Sector ETF",
  XLE: "Energy Select Sector ETF",
  XLF: "Financial Select Sector ETF",
  XLB: "Materials Select Sector ETF",
  XLV: "Health Care Select Sector ETF",
};

export function formatEventAsMiroFishSeed(event: FinancialEvent): MiroFishSeed {
  const instrumentList = event.affected_instruments
    .map((i) => `${i} (${INSTRUMENT_DESCRIPTIONS[i] ?? i})`)
    .join(", ");

  const agentTypes = getAgentUniverse(event.category);

  return {
    scenario_title: `Market Impact Analysis: ${event.title}`,
    scenario_description:
      `A ${event.severity} severity ${event.category} event has occurred. ` +
      `The event is: "${event.title}". ${event.summary}`,
    seed_materials:
      `Event Title: ${event.title}\n` +
      `Event Category: ${event.category}\n` +
      `Severity: ${event.severity}\n` +
      `Published: ${event.published_at}\n` +
      `Source: ${event.source}\n` +
      `Summary: ${event.summary}\n` +
      `Affected Markets: ${instrumentList}`,
    prediction_target:
      `Predict the directional impact (bullish/bearish/neutral) and estimated magnitude ` +
      `of price movement for each affected instrument: ${instrumentList}. ` +
      `Include predicted sentiment shift, volatility expectation, and time horizon (immediate/1-day/1-week).`,
    agent_universe: agentTypes,
    simulation_rounds: event.severity === "critical" ? 500 : event.severity === "high" ? 300 : 150,
    metadata: {
      cashpile_event_id: event.id,
      instruments: event.affected_instruments,
      category: event.category,
      severity: event.severity,
    },
  };
}

function getAgentUniverse(category: string): string {
  const base = "institutional traders (hedge funds, asset managers), retail investors, algorithmic trading systems, financial analysts and commentators, central bank observers";

  const categoryAgents: Record<string, string> = {
    fed: `${base}, bond traders, fixed income strategists, currency traders`,
    macro: `${base}, macro economists, currency traders, commodity traders`,
    geopolitical: `${base}, geopolitical risk analysts, energy traders, defense sector analysts`,
    earnings: `${base}, equity research analysts, options traders, sector ETF managers`,
    sector: `${base}, sector rotation traders, ETF arbitrageurs, industry analysts`,
    commodities: `${base}, commodity traders, energy sector analysts, inflation strategists`,
  };

  return categoryAgents[category] ?? base;
}

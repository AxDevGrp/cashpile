/**
 * Pulse Plan Configuration — defines instrument limits per plan tier
 */

import type { Plan } from "@cashpile/db";

export interface InstrumentLimit {
  maxInstruments: number;
  canSelectCustom: boolean;
  allowedCategories: string[];
  description: string;
}

export const PULSE_INSTRUMENT_LIMITS: Record<Plan, InstrumentLimit> = {
  free: {
    maxInstruments: 3,
    canSelectCustom: false,
    allowedCategories: ["majors"], // Only ES, NQ, CL
    description: "3 major indices/commodities",
  },
  books: {
    maxInstruments: 3,
    canSelectCustom: false,
    allowedCategories: ["majors"],
    description: "3 major indices/commodities",
  },
  trades: {
    maxInstruments: 5,
    canSelectCustom: true,
    allowedCategories: ["majors", "sectors", "bonds"],
    description: "5 instruments including sectors",
  },
  pulse: {
    maxInstruments: 10,
    canSelectCustom: true,
    allowedCategories: ["majors", "sectors", "bonds", "metals", "volatility"],
    description: "10 instruments - full market coverage",
  },
  pro: {
    maxInstruments: 20,
    canSelectCustom: true,
    allowedCategories: ["all"],
    description: "Unlimited instruments + custom",
  },
};

// Instrument categories
export const INSTRUMENTS_BY_CATEGORY = {
  majors: [
    { symbol: "ES", name: "S&P 500 E-mini", category: "majors" },
    { symbol: "NQ", name: "NASDAQ 100 E-mini", category: "majors" },
    { symbol: "YM", name: "Dow Jones E-mini", category: "majors" },
    { symbol: "RTY", name: "Russell 2000 E-mini", category: "majors" },
    { symbol: "CL", name: "Crude Oil (WTI)", category: "majors" },
    { symbol: "GC", name: "Gold", category: "majors" },
  ],
  sectors: [
    { symbol: "XLK", name: "Technology Sector", category: "sectors" },
    { symbol: "XLE", name: "Energy Sector", category: "sectors" },
    { symbol: "XLF", name: "Financial Sector", category: "sectors" },
    { symbol: "XLV", name: "Health Care Sector", category: "sectors" },
    { symbol: "XLI", name: "Industrial Sector", category: "sectors" },
    { symbol: "XLB", name: "Materials Sector", category: "sectors" },
    { symbol: "XLP", name: "Consumer Staples", category: "sectors" },
    { symbol: "XLU", name: "Utilities Sector", category: "sectors" },
  ],
  bonds: [
    { symbol: "TLT", name: "20+ Year Treasury", category: "bonds" },
    { symbol: "IEF", name: "7-10 Year Treasury", category: "bonds" },
    { symbol: "HYG", name: "High Yield Bonds", category: "bonds" },
    { symbol: "LQD", name: "Investment Grade Bonds", category: "bonds" },
  ],
  metals: [
    { symbol: "SI", name: "Silver", category: "metals" },
    { symbol: "PL", name: "Platinum", category: "metals" },
    { symbol: "PA", name: "Palladium", category: "metals" },
    { symbol: "HG", name: "Copper", category: "metals" },
  ],
  volatility: [
    { symbol: "VIX", name: "VIX Index", category: "volatility" },
    { symbol: "UVXY", name: "VIX Short-Term Futures", category: "volatility" },
  ],
  forex: [
    { symbol: "DXY", name: "US Dollar Index", category: "forex" },
    { symbol: "EURUSD", name: "Euro/USD", category: "forex" },
    { symbol: "GBPUSD", name: "GBP/USD", category: "forex" },
    { symbol: "USDJPY", name: "USD/JPY", category: "forex" },
  ],
};

export type Instrument = {
  symbol: string;
  name: string;
  category: string;
};

export function getAvailableInstruments(plan: Plan): Instrument[] {
  const limits = PULSE_INSTRUMENT_LIMITS[plan];
  
  if (limits.allowedCategories.includes("all")) {
    return Object.values(INSTRUMENTS_BY_CATEGORY).flat();
  }
  
  return limits.allowedCategories.flatMap(
    (cat) => INSTRUMENTS_BY_CATEGORY[cat as keyof typeof INSTRUMENTS_BY_CATEGORY] || []
  );
}

export function canAddInstrument(
  plan: Plan,
  currentCount: number,
  instrumentSymbol: string
): { allowed: boolean; reason?: string } {
  const limits = PULSE_INSTRUMENT_LIMITS[plan];
  
  if (currentCount >= limits.maxInstruments) {
    return {
      allowed: false,
      reason: `Your ${plan} plan allows ${limits.maxInstruments} instruments. Upgrade to add more.`,
    };
  }
  
  const available = getAvailableInstruments(plan);
  if (!available.some((i) => i.symbol === instrumentSymbol)) {
    return {
      allowed: false,
      reason: `This instrument requires a higher plan tier.`,
    };
  }
  
  return { allowed: true };
}

export function getDefaultInstruments(plan: Plan): string[] {
  // Free/Books get default majors
  if (plan === "free" || plan === "books") {
    return ["ES", "NQ", "CL"];
  }
  // Trades gets majors + one sector
  if (plan === "trades") {
    return ["ES", "NQ", "CL", "XLK", "TLT"];
  }
  // Pulse gets broader selection
  if (plan === "pulse") {
    return ["ES", "NQ", "CL", "GC", "XLK", "XLE", "TLT", "VIX", "DXY"];
  }
  // Pro gets everything
  return Object.values(INSTRUMENTS_BY_CATEGORY).flat().map((i) => i.symbol);
}

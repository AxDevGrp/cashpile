export const moduleHomeIds = ["cashflow", "subscriptions", "books", "tax", "trades", "pulse"] as const;
export type ModuleHomeId = (typeof moduleHomeIds)[number];
export type ModuleActionIcon = "wallet" | "repeat" | "book" | "file" | "chart" | "bell";

export type ModuleHomeDefinition = {
  title: string;
  detail: string;
  cashPrompt: string;
  detailsHref: string;
  actions: Array<{ label: string; href: string; icon: ModuleActionIcon }>;
};

const definitions: Record<ModuleHomeId, ModuleHomeDefinition> = {
  cashflow: { title: "Cash flow", detail: "Make the next money move clear.", cashPrompt: "Help me understand my cash flow", detailsHref: "/cashflow?view=details", actions: [{ label: "Check affordability", href: "/cashflow?view=details", icon: "wallet" }, { label: "Recurring", href: "/cashflow/recurring", icon: "repeat" }, { label: "Transactions", href: "/books/transactions", icon: "book" }, { label: "Home", href: "/cashboard", icon: "chart" }] },
  subscriptions: { title: "Subscriptions", detail: "Review recurring money in and out.", cashPrompt: "What subscriptions should I review?", detailsHref: "/cashflow/recurring?view=details", actions: [{ label: "Review recurring", href: "/cashflow/recurring?view=details", icon: "repeat" }, { label: "Cash flow", href: "/cashflow", icon: "wallet" }, { label: "Transactions", href: "/books/transactions", icon: "book" }, { label: "Home", href: "/cashboard", icon: "chart" }] },
  books: { title: "Books", detail: "Keep your financial records tidy.", cashPrompt: "What should I clean up in my books?", detailsHref: "/books?view=details", actions: [{ label: "Transactions", href: "/books/transactions", icon: "book" }, { label: "Categorize", href: "/books/transactions?filter=uncategorized", icon: "file" }, { label: "AI review", href: "/books/transactions/ai-review", icon: "chart" }, { label: "Import", href: "/books/transactions/import", icon: "file" }] },
  tax: { title: "Tax", detail: "Prepare records for tax work.", cashPrompt: "What should I prepare for taxes?", detailsHref: "/books/tax?view=details", actions: [{ label: "Tax workspace", href: "/books/tax?view=details", icon: "file" }, { label: "Entities", href: "/books/entities", icon: "book" }, { label: "Transactions", href: "/books/transactions", icon: "book" }, { label: "Reports", href: "/books/reports", icon: "chart" }] },
  trades: { title: "Trades", detail: "Keep your trading practice organized.", cashPrompt: "Help me review my trading routine", detailsHref: "/trades?view=details", actions: [{ label: "Accounts", href: "/trades/accounts", icon: "wallet" }, { label: "Journal", href: "/trades/journal", icon: "book" }, { label: "Log trade", href: "/trades/journal/new", icon: "file" }, { label: "Performance", href: "/trades/performance", icon: "chart" }] },
  pulse: { title: "Pulse", detail: "Stay close to the signals that matter.", cashPrompt: "What should I watch in Pulse?", detailsHref: "/pulse?view=details", actions: [{ label: "Alerts", href: "/pulse/alerts", icon: "bell" }, { label: "Events", href: "/pulse/events", icon: "chart" }, { label: "Watchlist", href: "/pulse/watchlist", icon: "book" }, { label: "Correlations", href: "/pulse/correlations", icon: "repeat" }] },
};

export function shouldRenderModuleEntrance(flag: boolean, view?: string): boolean {
  return flag && view !== "details";
}

export function getModuleHomeDefinition(id: ModuleHomeId): ModuleHomeDefinition {
  return definitions[id];
}

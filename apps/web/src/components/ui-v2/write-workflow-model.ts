export const writeWorkflowIds = [
  "accounts",
  "account-new",
  "entities",
  "entity-new",
  "category-rules",
  "trade-accounts",
  "trade-account-new",
  "journal",
  "journal-new",
  "alerts",
  "watchlist",
  "settings",
  "transactions",
  "account-transactions",
  "ai-review",
  "duplicates",
  "import",
  "tax-details",
  "plaid",
  "topup",
] as const;

export type WriteWorkflowId = (typeof writeWorkflowIds)[number];

type Definition = {
  route: string;
  riskGroup: "A" | "B";
  cashPrompt: string;
};

const definitions: Record<WriteWorkflowId, Definition> = {
  accounts: { route: "/books/accounts", riskGroup: "A", cashPrompt: "Help me review these accounts" },
  "account-new": { route: "/books/accounts/new", riskGroup: "A", cashPrompt: "Help me add an account" },
  entities: { route: "/books/entities", riskGroup: "A", cashPrompt: "Help me review these entities" },
  "entity-new": { route: "/books/entities/new", riskGroup: "A", cashPrompt: "Help me add an entity" },
  "category-rules": { route: "/books/category-rules", riskGroup: "A", cashPrompt: "Help me set up category rules" },
  "trade-accounts": { route: "/trades/accounts", riskGroup: "A", cashPrompt: "Help me review trade accounts" },
  "trade-account-new": { route: "/trades/accounts/new", riskGroup: "A", cashPrompt: "Help me add a trade account" },
  journal: { route: "/trades/journal", riskGroup: "A", cashPrompt: "Help me review my trade journal" },
  "journal-new": { route: "/trades/journal/new", riskGroup: "A", cashPrompt: "Help me log this trade" },
  alerts: { route: "/pulse/alerts", riskGroup: "A", cashPrompt: "Help me review these alerts" },
  watchlist: { route: "/pulse/watchlist", riskGroup: "A", cashPrompt: "Help me review my watchlist" },
  settings: { route: "/settings", riskGroup: "A", cashPrompt: "Help me understand these settings" },
  transactions: { route: "/books/transactions", riskGroup: "B", cashPrompt: "Help me review these transactions" },
  "account-transactions": { route: "/books/accounts/[accountId]/transactions", riskGroup: "B", cashPrompt: "Help me review this account" },
  "ai-review": { route: "/books/transactions/ai-review", riskGroup: "B", cashPrompt: "Help me review these suggestions" },
  duplicates: { route: "/books/transactions/duplicates", riskGroup: "B", cashPrompt: "Help me review possible duplicates" },
  import: { route: "/books/transactions/import", riskGroup: "B", cashPrompt: "Help me import transactions" },
  "tax-details": { route: "/books/tax?view=details", riskGroup: "B", cashPrompt: "Help me review this tax workspace" },
  plaid: { route: "embedded-plaid", riskGroup: "B", cashPrompt: "Help me connect an account" },
  topup: { route: "embedded-stripe-topup", riskGroup: "B", cashPrompt: "Help me understand AI credits" },
};

export function shouldRenderWriteWorkflow(flag: boolean) {
  return flag;
}

export function getWriteWorkflow(id: WriteWorkflowId) {
  return definitions[id];
}

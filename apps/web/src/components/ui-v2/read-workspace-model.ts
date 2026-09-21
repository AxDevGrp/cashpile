export const readWorkspaceIds = ["reports", "recurring", "performance", "events", "correlations", "accounts", "entities"] as const;
export type ReadWorkspaceId = (typeof readWorkspaceIds)[number];

const definitions = {
  reports: { route: "/books/reports", title: "Reports", detail: "Review tax-ready records.", cashPrompt: "Help me understand my reports" },
  recurring: { route: "/cashflow/recurring?view=details", title: "Recurring cash flow", detail: "Review detected recurring money.", cashPrompt: "What recurring charges should I review?" },
  performance: { route: "/trades/performance", title: "Performance", detail: "Review trading performance.", cashPrompt: "Help me understand my trading performance" },
  events: { route: "/pulse/events", title: "Events", detail: "Review recent market events.", cashPrompt: "What events should I watch?" },
  correlations: { route: "/pulse/correlations", title: "Correlations", detail: "Compare market relationships.", cashPrompt: "Help me understand these correlations" },
  accounts: { route: "/books/accounts", title: "Accounts", detail: "Manage financial accounts.", cashPrompt: "What should I review in my accounts?" },
  entities: { route: "/books/entities", title: "Entities", detail: "Organize tax entities.", cashPrompt: "What should I review for my entities?" },
} satisfies Record<ReadWorkspaceId, { route: string; title: string; detail: string; cashPrompt: string }>;

export function shouldRenderReadWorkspace(flag: boolean): boolean { return flag; }
export function getReadWorkspaceDefinition(id: ReadWorkspaceId) { return definitions[id]; }

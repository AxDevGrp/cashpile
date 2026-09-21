export const phase7SurfaceIds = [
  "login",
  "signup",
  "plaid-oauth",
  "unavailable",
  "dashboard-loading",
  "reports-loading",
  "transactions-loading",
  "correlations-loading",
  "events-loading",
  "journal-loading",
  "performance-loading",
  "dashboard-error",
  "books-error",
  "pulse-error",
  "settings-error",
  "trades-error",
] as const;

export type Phase7SurfaceId = (typeof phase7SurfaceIds)[number];

export type Phase7SurfaceDefinition = {
  kind: "auth" | "oauth" | "unavailable" | "loading" | "error";
  title: string;
  detail: string;
};

const definitions: Record<Phase7SurfaceId, Phase7SurfaceDefinition> = {
  login: {
    kind: "auth",
    title: "Welcome back",
    detail: "Sign in to continue with Cash.",
  },
  signup: {
    kind: "auth",
    title: "Create your account",
    detail: "Start free. No credit card required.",
  },
  "plaid-oauth": {
    kind: "oauth",
    title: "Finishing Plaid Link",
    detail: "Cash is securely resuming your bank connection.",
  },
  unavailable: {
    kind: "unavailable",
    title: "Page unavailable",
    detail: "This page could not be found or is not available to this account.",
  },
  "dashboard-loading": {
    kind: "loading",
    title: "Loading dashboard",
    detail: "Cash is preparing your financial overview.",
  },
  "reports-loading": {
    kind: "loading",
    title: "Loading reports",
    detail: "Cash is preparing your reports.",
  },
  "transactions-loading": {
    kind: "loading",
    title: "Loading transactions",
    detail: "Cash is preparing your transaction workspace.",
  },
  "correlations-loading": {
    kind: "loading",
    title: "Loading correlations",
    detail: "Cash is comparing market relationships.",
  },
  "events-loading": {
    kind: "loading",
    title: "Loading events",
    detail: "Cash is gathering recent market events.",
  },
  "journal-loading": {
    kind: "loading",
    title: "Loading journal",
    detail: "Cash is preparing your trade journal.",
  },
  "performance-loading": {
    kind: "loading",
    title: "Loading performance",
    detail: "Cash is preparing your trading performance.",
  },
  "dashboard-error": {
    kind: "error",
    title: "Something went wrong loading the dashboard",
    detail: "Try the dashboard again.",
  },
  "books-error": {
    kind: "error",
    title: "Something went wrong in Books",
    detail: "Try Books again.",
  },
  "pulse-error": {
    kind: "error",
    title: "Something went wrong in Pulse",
    detail: "Try Pulse again.",
  },
  "settings-error": {
    kind: "error",
    title: "Something went wrong in Settings",
    detail: "Try Settings again.",
  },
  "trades-error": {
    kind: "error",
    title: "Something went wrong in Trades",
    detail: "Try Trades again.",
  },
};

export function shouldRenderPhase7Surface(flag: boolean): boolean {
  return flag;
}

export function getPhase7Surface(
  id: Phase7SurfaceId,
): Phase7SurfaceDefinition {
  return definitions[id];
}

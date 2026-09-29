import type { CashboardSnapshot } from "@cashpile/ai";

export interface CashboardSnapshotDeps {
  /** Resolve the session user id; null when unauthenticated. */
  getUserId: () => Promise<string | null>;
  /** Load the snapshot for a server-resolved user id (never client-supplied). */
  loadSnapshot: (userId: string) => Promise<CashboardSnapshot>;
}

export interface CashboardHttpResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * Session-authenticated handler core. The owner id comes only from the session;
 * there is no userId input. Dependency failure returns 503, not a fabricated 200.
 */
export async function handleCashboardSnapshot(
  deps: CashboardSnapshotDeps
): Promise<CashboardHttpResponse> {
  const userId = await deps.getUserId();
  if (!userId) {
    return { status: 401, body: { error: { code: "unauthenticated" } }, headers: { ...NO_STORE } };
  }

  try {
    const snapshot = await deps.loadSnapshot(userId);
    return { status: 200, body: snapshot, headers: { ...NO_STORE } };
  } catch {
    return {
      status: 503,
      body: { error: { code: "snapshot_unavailable" } },
      headers: { ...NO_STORE },
    };
  }
}

# Stage 08 — read-only agent summaries and connection control

Requires 03 and 07. This stage does not implement MCP transport, financial write permissions, passkeys or payments.

## Allowed files

- `apps/web/src/modules/agent/{types,auth,capabilities,executor,audit}.ts`, capability tests; new `consumer-agent.ts`, `consumer-agent.test.ts`.
- Existing `/api/agent/tools/call`, discovery/resource routes only for additive capability/error mapping; new `/api/agent/connections/route.ts` and `/api/agent/connections/[id]/route.ts`.
- New `modules/agent/connections.ts` with testable service helper; settings client adds connection list/create/revoke panel.
- New `packages/db/migrations/029_consumer_agent_controls.sql`, `packages/db/tests/consumer-agent-controls.sql`; `packages/db/src/types.ts` for exact additive table types. Primary reviews/applies isolated migration.
- `packages/ai/src/orchestrator/tools.ts` for additive consumer summary tool only; no web→AI package circular import.

## Exact capabilities

- Add scope `cashboard:read` to AgentScope and server allowlist. Do not automatically grant it to old external connections. Authenticated owner sessions may manage their own new connections; external credentials cannot.
- `cashboard.summary.get`: read, scope cashboard:read, input empty object/no additional properties. Output version/currency/asOf plus five `{id,value,unit,quality,period,asOf,reasons}` metrics and unresolved count only. Exclude metric rows, raw cashflow snapshot, transactions, account IDs and descriptions.
- `cashboard.metric.explain`: read, same scope, input `{metricId}` enum five IDs. Return the same aggregate metric plus deterministic plain-English definition and assumptions from contracts.md. No merchant/account evidence details with summary-only scope. Users requiring transaction detail use existing books:read capability separately.
- Both execute getCashboardSnapshot using the authenticated principal's owner, never an input owner. Do not ask an LLM to recalculate the amount or explanation.
- After a successful external-agent call, update its owned agent_connections.last_used_at with server time. Do not record request financial data in that update.
- In-app assistant receives the same summary tool through existing orchestrator. Legacy cashflow tools stay compatible and describe 30-day vs payday semantics accurately.

## Validation/rate-limit implementation

1. Add strict Zod validators for these two capability inputs in consumer-agent.ts and call before any DB/model work. Capability metadata alone is not runtime validation.
2. Migration 029 adds `agent_rate_windows(user_id UUID,capability TEXT,window_start TIMESTAMPTZ,request_count INTEGER, PRIMARY KEY(user_id,capability,window_start))` with service-only access. Add service-only `consume_agent_rate(p_user_id,p_capability,p_limit)`; server minute bucket using database clock, atomic increment/reject, limit=60 per owner/capability/minute. Rejection does not increment beyond limit. Reject invalid limits outside 1..120. Primary-approved scheduled cleanup deletes buckets older than 24h; no unbounded retention.
3. Enforce limit on new capabilities before snapshot load; 61st request returns 429 / error code rate_limited, with Retry-After until next minute. Share rate across processes/connections; no in-memory-only limiter. Existing capabilities retain behavior in this stage; do not imply their metadata limits have been audited/enforced.
4. Extend AgentCallResult additively with `errorCode?: 'invalid_input'|'missing_scope'|'rate_limited'|'snapshot_unavailable'` and `retryAfterSeconds?: number`. New capabilities set these fields deterministically; retain existing error string for compatibility. `/api/agent/tools/call` mapping: unauthenticated→401; malformed name/input→400; missing_scope→403; rate_limited→429 with Retry-After; snapshot_unavailable→503. Unknown capability retains current 400. Legacy errors without errorCode retain current mapping. Tests assert HTTP status AND errorCode. No raw token or source payload in logs.

## Connections UI/API

- GET connections: session owner only; id,name,scopes,status,created_at,last_used_at; no token_hash.
- POST connections: session+same-origin only, input `{name}` (trimmed 1..80 chars, no extras); fixed scope `["cashboard:read"]`. At most 10 active connections/owner, enforced atomically in DB. Generate 32 cryptographic random bytes; store only SHA-256 hash with existing agent_connections schema. Return plaintext token exactly once, no server log/browser persistence. UI explains limited access and manual copy to the user's agent. New scope issuance only to an eligible consumer user.
- DELETE `/connections/[id]`: owner session+same-origin, revoke owned ID; repeating revoke succeeds idempotently; foreign/nonexistent ID 404; external bearer credential cannot create/revoke connections. Token auth checks active DB status on every request.
- Replace broad authenticated direct UPDATE policy on agent_connections with owner SELECT only; all new create/revoke operations use narrowly scoped security-definer RPCs (caller auth.uid, no supplied owner), so users cannot change token_hash/scopes/status through generic Data API writes. Preserve service-owned creation paths, do not expose service key.
- Name RPCs `consumer_create_agent(p_name TEXT,p_token_hash TEXT)` and `consumer_revoke_agent(p_id UUID)`. Create enforces fixed scope/cap under a per-owner transaction advisory lock; session can supply only a valid 64-character lowercase SHA-256 hash from server. Revocation logs metadata-only audit event; do not change meaning of old preview audit rows.
- UI shows scopes, last-used/status, Copy-once creation disclosure and Revoke confirmation. No payment-permission controls and no “Approve” action.

## Tests / exit gate

- New external token reads summary, cannot call existing books:read/write tools without those scopes; owner B credentials never return owner A values.
- Returned summary/explanation contains no cashflow/accounts/transactions/evidence rows. Values match UI contract fixture to cent and period.
- Token creation yields random distinct tokens, hash-only DB record; 11th active creation rejected, two concurrent tenth attempts only one succeeds.
- Direct authenticated scope/token/status update denied; revoked token rejected on next request; external token cannot invoke settings API.
- Unknown input keys/userId rejected; 60 allowed then 429 across two clients; next minute resets; source outage not zero-valued success.
- Existing capability/Books tests unchanged; add node tests and isolated SQL tests; typecheck/build passes. No full MCP compatibility claim in copy/docs: existing `/api/agent/mcp` remains a discovery catalog until a separately planned protocol stage.

Primary reviews authorization and migration before acceptance. No payment capability added to discovery or executor.

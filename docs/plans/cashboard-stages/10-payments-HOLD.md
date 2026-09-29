# Stage 10 — agent payments: HOLD

**Do not implement live payments from this document.** The approved fourth mockup is a product direction, not a selected provider, approved money-movement architecture or consent mechanism. An executor must stop here; it must not choose those details.

Release A intentionally omits payment requests from live data, navigation and agent capabilities. Preserve the PNG as the future reference. No fake passkey/approve button, no transfers through AI-credit billing, no agent-returned confirmation token treated as human consent.

## Primary/user inputs required to unlock a later executor pack

| Required decision | Exact record required |
| --- | --- |
| Provider/rail | Provider, contracted product, supported third-party biller/recipient types and geography; sandbox/live access verified. Bank-data access alone is insufficient. |
| Responsibility | Who handles onboarding/identity checks, authorization evidence, disputes, returns, support, fees and applicable compliance review. |
| User authority | Owner-only fresh approval, supported step-up method, enrolled credential/recovery flow, identity binding; no automatic mandates in first release. |
| Payment limits | Per-payment and daily/monthly cumulative limits, per-agent scope, allowed verified payees and funding accounts. Concrete amounts/currencies approved, not copied from mockup. |
| Lifecycle | Provider status/event mapping, idempotency semantics, submission timeout recovery, failure/return/cancel windows and receipt retention. |
| Financial effect | Exact obligation/payment matching contract so “already budgeted” cannot double-count or hide an additional outflow. |

Once these are approved, primary writes a new **prescriptive** pack with provider-specific schema, endpoints, signed/consumed approval binding, verified passkey/step-up implementation, atomic limit reservation, authenticated webhook handling and status reconciliation. Do not tell the executor to “choose best practice.”

## Required sequence for that future pack

1. Isolated request/approval schema + owner/agent separation and threat-model tests.
2. Provider sandbox adapter + idempotent request state machine.
3. Screen 4 with actual server checks, approval tied to immutable request details, decline/revoke/status.
4. Replay/altered details/concurrent limit/expired approval/revoked agent/provider-timeout/duplicate-event/return tests.
5. Primary security review and explicitly authorized narrow live launch.

No progress beyond this gate without the new approved pack. The existing `modules/agent/confirmation.ts` and preview-returned token are not adequate human payment approval and must not be repurposed.

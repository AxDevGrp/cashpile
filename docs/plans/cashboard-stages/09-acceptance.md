# Stage 09 — final acceptance and controlled rollout

Requires stages 01–08 accepted. Primary-owned release gate, not an invitation to refactor unrelated failures.

## Evidence and allowed changes

- Fix only confirmed regressions within the originating stage's allowlist; report required broader fixes for primary approval.
- Review findings under `docs/reviews`; executor evidence attached to handoff. Do not edit frozen plans to declare incomplete acceptance complete.
- Add `test:consumer` package scripts only if necessary to ensure new tests are runnable with the existing Node runner. Ensure SQL isolated tests are discoverable in handoff.

## Ordered checklist

1. Run baseline suites from stage 00 individually, then new stage-specific unit/integration/SQL tests. No failed or unrun check reported passed. Confirm no TypeScript test is omitted by a glob.
2. Unit coverage: new nontrivial consumer calculation/policy/review logic ≥80% using Node's test coverage support; record actual coverage, not test count. Existing unrelated coverage gaps do not authorize deleting code/tests. Integration tests cover SQL permissions/races; browser checks cover real user flow.
3. Use synthetic fixture owner A/B and a provider stub in isolated staging. Never import real account credentials into test fixtures or general analytics.
4. End-to-end: connect stub account → include/confirm currency → load home while jobs pending → worker resolves known cases → open availability/detail → clarify unknown rent → revise it in Activity → preview purchase/savings → disconnect/reconnect → read same summary with limited agent token → revoke token.
5. Failure flow: AI timeout, exhausted job, partial sync, stale account, missing currency/allowance, two concurrent saves, cross-user IDs, expired sync lease, model injection text, insufficient chat credits. Existing data stays safe and UI states are truthful.
6. Visuals: 360×800, 390×844, 768×1024, 1440×1000; all routes in stage 07, deep links and advanced workspace. Check 200% zoom, screen-reader labels/status, keyboard focus, reduced motion, long merchant/large balances, empty/loading/error, safe area and mobile keyboard. No clipping or white-on-lime text.
7. Gate matrix: consumer cohort true/false × UI_V2 true/false × direct consumer/advanced route. Noncohort presentation is unchanged. Test disabling cohort while requests exist; future read sees fallback, no deletion.
8. Check bundle/source for mock fixture numbers and payment copy in live components; fixtures are tests only. No hardcoded “94% accuracy”, imaginary trend or false transfer success.
9. Review before/after same-snapshot fixtures. Missing data is never silently zero; payday amount never becomes old 30-day safeToSpend via a consumer tool.
10. Verify operational scheduler invokes interpretation route with secret, errors are monitored, failed jobs are visible to primary, background AI budget env remains explicitly operator-controlled. No model cost for balance viewing/corrections.

## Rollout, primary only

- Apply additive migrations after backup/restore rehearsal and isolated SQL acceptance; no DROP of existing transaction tables or legacy fields. Record deployed migration IDs.
- Enable a small named internal cohort using existing DB flag. No global enable from executor. Verify same consumer theme everywhere and summary-agent auth before adding users.
- Track aggregate time to first useful snapshot, correction retention, classification audit error rate, duplicate-sync incidents and unavailable metric reasons. Do not log raw transaction text/balances in generic telemetry.
- Accept audited automation coverage as measured, not assumed 90%. High automation with financial misclassification is a release failure.
- Rollback: disable consumer cohort/flag; stop new background model work if implicated; keep deterministic sync/correction data compatible with legacy. Do not roll back migrations by deleting user decisions. Primary chooses compensating migration for any schema defect.

## Release A done means

- Three live consumer screens + complete supporting journey approved visually and functionally.
- All stage financial/security fixtures pass; no known cross-user leak, lost correction, duplicate-money effect or false approval.
- Agent access is read-only, revocable and scope-limited; no payment infrastructure activated.
- Reviewer findings resolved and final validations rerun by primary. A launched pipeline or generated screenshot is not release evidence.

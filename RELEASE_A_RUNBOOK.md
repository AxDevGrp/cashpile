# Release A runbook — Cashpile Midnight & Lime

Status: prepared, **not executed**. No production change has been made.
Owner of every production step below: the primary (you). The executor prepares and
verifies; it does not apply production migrations, deploy, or enable the cohort.

Plain-English summary: three things ship together — (1) new filing-cabinet
drawers in Supabase, (2) new website code on Railway, (3) a switch that turns the
new experience on for a few named people. Order matters: cabinet first, website
second, switch last.

---

## 0. Preconditions (must all be true)

- [ ] Stages 01–08 accepted by primary.
- [ ] Sandbox verification green (see "Verified evidence" below).
- [ ] Production backup taken and a restore rehearsed (step 1).
- [ ] `pnpm` available (10.30.3) so typecheck/tests run.
- [ ] Production `DATABASE_URL` (session pooler, direct) available to the operator only.

## 1. Back up production

1. Supabase dashboard → Database → Backups. Confirm a recent automated backup exists.
2. Take a manual backup / point-in-time marker before applying anything.
3. Rehearse a restore into a throwaway project so the process is proven, not assumed.

## 2. Apply the migrations (additive, ordered)

Migrations are **not** shipped by a code push. Apply them explicitly:

```bash
DATABASE_URL="<production session-pooler URI>" \
  packages/db/migrations/apply_cashpile_wp_migrations.sh
```

The script applies only what is missing, in order: `010` (agent tables — currently
absent from production), then `023`–`026` (skipped if already present), then
`027`, `028`, `029`. It finishes by running the read-only cross-user RLS
verification (expect `11 passed, 0 failed`).

Expected on first production run: `010`, `027`, `028`, `029` apply; `023`–`026`
skip. Record the deployed migration IDs here:
`rolled out: ____`.

Then run the isolated contract fixtures against production **read-only expectations**?
No — the fixtures write and roll back. Run them only in the isolated copy, not
production. Instead, spot-check production read-only:

```sql
select to_regclass('public.books_transaction_interpretations'),
       to_regclass('public.books_interpretation_jobs'),
       to_regclass('public.agent_rate_windows');
```

No `DROP` of any existing transaction table or legacy field occurs.

## 3. Backfill existing transactions (primary-run, once)

The consumer feature only sees rows that have an interpretation. New rows get one
automatically, but the 19k+ transactions that already existed do **not** — without
this step the review queue and passive-income metric are empty for history. The
plan requires this to be a bounded, restartable, primary-run loop
(`01-persistence.md`).

```bash
DATABASE_URL="<production session-pooler URI>" \
  packages/db/migrations/backfill_consumer_interpretations.sh 1000
```

It inserts only missing interpretation/job rows in batches, never infers meaning
from old categories (rows start `unknown`, review required), and is safe to re-run.
Expect roughly `transactions` rows added. This enqueues background jobs; with
`CASHPILE_BACKGROUND_AI_ENABLED` unset they are processed by deterministic rules
only, about 20 per minute, so the queue drains over hours.

## 4. Deploy the code

- Merge/push to `main` → Railway rebuilds `cashpile-web` (watch paths
  `apps/web`, `packages`). Confirm the deploy is green and `/api/health` returns 200.
- Migrations are already applied, so the new code finds the drawers it expects.
- Do **not** enable the feature for anyone yet.

## 5. Enable a small named cohort

Using the existing DB flag (no global enable from the executor):

```sql
update app_feature_flags
   set cohorts = cohorts || '<internal-user-uuid>'
 where key = 'decision_first_experience';
```

Add one or two internal testers. Keep `enabled = false` so only listed users see it.

Verify for that user: consumer theme on `/cashboard`, `/books/transactions`,
`/books/accounts`; advanced routes still reachable; and agent summary auth (create
a token, read the summary, revoke it).

## 6. Monitor (aggregate only — no raw text/balances in telemetry)

- Time to first useful snapshot.
- Correction retention (are saved corrections still there after a resync?).
- Classification audit error rate.
- Duplicate-sync incidents.
- Counts and reasons for unavailable metrics.
- Failed interpretation jobs: `select status, count(*) from books_interpretation_jobs group by 1;`
  Failed rows are visible to the primary; background AI stays off unless
  `CASHPILE_BACKGROUND_AI_ENABLED=true` is set deliberately by the operator.

## 7. Rollback (primary only)

1. Disable the cohort/flag (`enabled = false`, remove cohort UUIDs).
2. If background model work is implicated, unset `CASHPILE_BACKGROUND_AI_ENABLED`.
3. **Do not** delete user decisions or drop columns to roll back. The new tables are
   additive; legacy code ignores them. If a schema defect needs reversal, the primary
   chooses a compensating migration.

---

## Verified evidence (sandbox `mhrjnnqpmfxxqgndrmsm`, not production)

| Check | Result |
|---|---|
| `test:books` | 29/29 |
| `test:ui-v2` | 27/27 |
| `test:release` | 45/49 — 4 pre-existing `tax-release-actions` failures |
| `test:lib` | 32/36 — same 4 pre-existing |
| `@cashpile/ai test` / `test:cashflow` | 67/67 / 66/66 |
| typecheck (ai, db, web) | clean |
| `build` | compiled, 73/73 static pages |
| `ui-migration:test` | 9/9, 34 routes (1 documented exception) |
| Stage 01/04 SQL fixtures | ALL PASS |
| Stage 08 SQL fixture | ALL PASS |
| Stage 08 concurrency test | PASS (one success, one `limit_reached`, 10 active) |
| Backfill script | PASS on sandbox (batched by 5, exact restore, no-op on rerun) |

Coverage (new logic, Node built-in): `consumer-agent.ts` 98.6%,
`connections.ts` 100%, `consumer-interpretation.ts` 100%, `consumer-review.ts` 98.0%,
`plaid-ingestion.ts` 98.7%, `consumer-model.ts` 98.9%, `consumer-experience-policy.ts`
100%, `cashboard-api.ts` 100%, `interpretation-worker.ts` 89.3% (branch 50%),
`cashboard.ts` 99.5%. `categorization.ts` 71.8% overall reflects pre-existing
unrelated branches; the Stage 02 batch-fallback path is covered.

## Not done here (needs a running app / a person)

- Browser journeys and viewports (360×800, 390×844, 768×1024, 1440×1000), 200%
  zoom, keyboard/screen-reader, reduced motion, long merchant names, empty/loading/error.
- The full end-to-end flow (connect stub → include/confirm → home → worker →
  clarify → revise → preview → disconnect/reconnect → agent read → revoke).
- Failure-flow drills (AI timeout, exhausted job, partial sync, stale account,
  missing currency/allowance, concurrent saves, expired lease, model injection).
- Gate matrix across cohort × `NEXT_PUBLIC_UI_V2` × route.

These are the primary's visual/functional acceptance steps and produce screenshots
as release evidence. Automated checks above are not a substitute.

## Known accepted limitations

- `interpretation-worker.ts` branch coverage is 50% (line 89.3%).
- `categorization.ts` overall coverage is pre-existing and unrelated to the new path.
- 4 pre-existing `tax-release-actions` test failures (present since Stage 00; not regressions).

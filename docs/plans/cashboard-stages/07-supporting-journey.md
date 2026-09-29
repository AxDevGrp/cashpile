# Stage 07 — finish the consumer journey

Requires 06. Do not ship a polished home that drops users into incompatible accounting screens for everyday tasks.

## Allowed files

- `app/(app)/books/transactions/page.tsx`, existing `_components/transactions-client.tsx`; new `_components/consumer-activity-client.tsx`.
- `app/(app)/books/accounts/page.tsx`, existing `_components/accounts-client.tsx`; `components/plaid-link-button.tsx` presentation only.
- `app/(app)/cashflow/actions.ts`, `cashflow/recurring/page.tsx`, `cashflow/recurring/actions.ts`, recurring review clients, `cashflow/what-if/page.tsx` and its client.
- `app/(app)/settings/page.tsx`, `settings/_components/settings-client.tsx`, `settings/actions.ts`; `app/(app)/ai/page.tsx`, `_components/cash-overlay.tsx`; `cashboard/_components/cash-input-strip.tsx`.
- `components/ui-v2` CSS/presentation primitives; `modules/books/actions/account.actions.ts`, `transaction.actions.ts` only for the named consumer filters/revalidation/ownership fixes. `app/(auth)/login/page.tsx` and `signup/page.tsx` styles only, no auth behavior changes or new recovery route.

## Ordered tasks

1. Activity eligible branch renders latest 50 owned transactions immediately; remove `requireQuery` only in consumer mode. Existing advanced branch remains unchanged behind `?view=advanced`. Reuse listTransactions filters/pagination, not a second transaction store. Add deterministic date DESC,id ASC ordering and correct range handling for offset=0 as necessary.
2. Consumer Activity supports account/date/search filters, row detail, category/interpretation edit via stage 04 and Load more. Include pending label and unknown label separately. No tax/entity columns in consumer list; no claim a transfer category alone proves internal movement. Detail reuses current ownership-checked transaction lookup and review save.
3. Accounts eligible branch reuses connect/reconnect/sync/manual controls and existing role settings. Show actual connection/import/interpretation states: linked-item status + job counts + timestamps. Expose only safe aggregate job status to session owner; never lease tokens/provider credentials.
4. After linking, show the owner's new accounts with Personal-plan inclusion unchecked and proposed role. Save inclusion/role via existing action extended with strict boolean/UUID validation and stored role check: isEmergency=true requires effective persisted role reserve, not a guessed default. One confirmation submits selected accounts; no category wizard.
5. Manual-account currency confirmation and balance edit use stage 02 fields. Existing accounts with null currency show “Confirm currency,” not a USD total. Do not silently blend business/tax-linked accounts; present an inclusion warning and leave user's explicit choice authoritative.
6. Settings consumer view retains buffer, weekly essential allowance, timezone and emergency target. Explain essentials exclude separately listed recurring bills; zero distinct from blank. Validate server-side, revalidate via shared helper. Buffer/allowance inputs never call a model.
7. Recurring review stays editable, with Confirm/Not recurring/manual bill inputs. Apply semantic dark styling and existing save errors. Source user decisions survive detection refresh; never hide the underlying observed transaction when “not recurring” is chosen.
8. What-if keeps explicit type, amount, date and reserve target, one snapshot baseline/comparison and no movement. Use new metric names/window in consumer branch. Invalid/out-of-window date and foreign reserve fail server-side. A savings preview changes reserve but purchase does not. No long-lived client-side computed financial answers.
9. Rename visible consumer chat to Ask Gremmy. Reuse overlay, stream and credit guard. Contextual prompts attach metric ID (not raw trusted financial values); orchestrator retrieves server snapshot. Show no-credit/model failure politely; rest of app still works. No changes to billing credit prices or secrets.
10. Replace hardcoded light-only colors only in these reachable surfaces with scoped semantic styles. Propagate consumer theme to dialogs/toasts. Advanced Books/Tax/Trades/Pulse retain structure and business behavior; fix shared control contrast in their consumer shell, not their accounting workflows.
11. Coordinate sign-in/recovery page color treatment as an explicit separate scoped class, preserving all existing form actions/redirects. Marketing pages excluded. Sign-out must clear user-scoped review sessionStorage and not expose last user's cached data.

## Required acceptance checks

- User connects → confirms included accounts → sees partial Cashboard while interpretation pending → no category setup required. Disconnect/reconnect remains usable.
- Activity starts with recent data, filters/page append do not duplicate rows, correct transaction detail edit refreshes totals. Advanced route remains available and authorization unchanged.
- Saving buffer 0 does not restore default; missing essentials does not become 0. Currency unconfirmed prevents mixed totals until explicitly resolved.
- Emergency designation cannot be saved onto spending account by omitting role from payload.
- Purchase $400 reduces spending by $400, reserve unchanged; savings preview reduces spending and increases selected reserve by $400. Neither writes a payment/transfer.
- Model outage and no credits do not disable Accounts, Activity, review or Cashboard. Mobile keyboard leaves inputs/actions reachable.
- UI gate matrix applies across all supporting routes and direct links, not only home.

Run Books, cashflow, UI-v2 and release tests; typecheck/build; record browser journey at 390×844 and desktop, keyboard/zoom/failure cases. Primary accepts no mismatched light panels or dead-end links in the consumer journey.

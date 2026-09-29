# Stage 05 — cohort-consistent shell and Midnight & Lime

Requires 00; may execute before backend stages in a separate worktree. This stage is presentation/gating only, not a financial or database change. Primary keeps rollout disabled until stage 09.

## Exact file targets

- `apps/web/src/app/(app)/layout.tsx`; new `_components/app-layout-client.tsx`.
- New `apps/web/src/lib/consumer-experience-policy.ts`, `.test.ts`, `consumer-experience.ts` (names/signatures in contracts.md).
- `apps/web/src/app/(app)/cashboard/page.tsx` only to reuse resolver; no new metric data fetch here yet.
- `apps/web/src/components/ui-v2/components.tsx`, `model.ts`, `model.test.ts`, `ui-v2.module.css`.
- `apps/web/src/app/globals.css` only for scoped `.cashpile-consumer` semantic tokens/overrides; no changes to existing :root/.dark default values.
- `app/(app)/_components/cash-overlay.tsx` and `packages/ui/src/components/ui/*` only for optional consumer-theme plumbing/semantic styles that preserve default rendering.

## Exact implementation sequence

1. Predicate tests first: unauthenticated/missing row false; enabled true; matching cohort true; malformed/nonmatching cohorts false. Do not export service-role feature data to the client.
2. Move the current client layout unchanged into app-layout-client.tsx. New async server layout calls request-cached getConsumerExperience() and passes `{consumerEnabled:boolean}`. Client component retains pathname, navigation pin, tax access fetch, CashOverlayProvider and toaster.
3. Client chooses `consumerEnabled || isUiV2Enabled()` for V2 shell; otherwise legacy Sidebar. Extend AppShellV2 with optional `theme:'default'|'consumer'` defaulting to default; append consumer class, do not replace structural appShell class.
4. Extend `getAppNavigation(showTaxModule,consumerEnabled=false)`. Consumer array exactly three primary/mobile entries: `/cashboard` Cashboard, `/books/transactions` Activity, `/books/accounts` Accounts. Keep nonconsumer array byte-for-byte equivalent in behavior.
5. Add `getConsumerActiveHref(pathname)` in model.ts: /cashflow and /cashboard→/cashboard; /books/transactions and nested→Activity; /books/accounts and nested→Accounts; settings/advanced/ai→undefined. Query strings do not change primary selection. Keep longest-match legacy helper intact.
6. Add profile/menu trigger in consumer shell linking Settings, Ask Gremmy and Advanced. Advanced links to existing Books, authorized Tax, Trades, Pulse destinations; retain their existing endpoint authorization. Use existing disclosure/menu primitive or native details/summary, no new dependency. Visible labels/icons, not tooltips alone.
7. Apply .cashpile-consumer semantic HSL variables matching contracts.md palette. Add local shell CSS variables for previously hardcoded UI-v2 colors. Default variable values reproduce existing light shell. Override only consumer; no global replacement of all cream colors.
8. Consumer canvas/surfaces solid; remove glass-card white border/blur only under consumer scope. Primary buttons dark text on lime, outline secondary, visible lime focus ring, danger text/icons separate from decoration. Keep 20–24px card radius and 12–16px controls; Inter/tabular numbers.
9. Mobile nav exactly three equal labeled items, fixed/sticky with env(safe-area-inset-bottom), content bottom padding nav height+safe area. Desktop retain current rail structure with usable labels accessible on focus; menu reachable at both sizes.
10. Put shell AND Toaster under one client wrapper `<div className={consumerEnabled ? 'cashpile-consumer' : undefined}>`. Add optional consumerEnabled prop to CashOverlayProvider and its portal host; render the same scoped class on the host when it is outside that wrapper. All token-dependent overlay content must be a descendant of one of these scoped roots. Never apply a global body/document theme mutation. Default behavior remains unchanged for nonconsumers.
11. Cashboard server page calls same cached resolver instead of duplicating DB query. It remains server-rendered and does not render both new/legacy data paths before hiding one.

## Tests and browser assertions

- Matrix: consumer false/UI_V2 false → legacy; false/true → old V2; true/false and true/true → Midnight shell. Test global flag, cohort-only, missing/error flag and anonymous user.
- Consumer nav exact three items, nested review active Activity, cashflow active Cashboard; settings no false active item. Legacy navigation tests unchanged.
- Deep-link /cashflow?view=details and /books/transactions/ai-review get same shell as /cashboard for one user. Query `consumer=true` cannot enable anything.
- 390×844 and 1440×1000: no double sidebar/bottom-nav, no horizontal overflow; 200% zoom, keyboard menu/skip link/focus; modal/toast readable; public/sign-in unaffected at this stage.
- Existing `test:lib`, `test:ui-v2`, ui-migration:test and typecheck. Protected-path guard must show no changes to DB/API/modules; if it reports a preexisting mismatch report it, do not rewrite baseline.

Exit: primary compares screenshots to dark reference, approves palette/contrast and flag matrix. No live fixture balance or payment request added.

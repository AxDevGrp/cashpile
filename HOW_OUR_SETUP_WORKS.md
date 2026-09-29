# How Our Setup Works (plain English)

A non-technical guide to how Cashpile is put together, how changes reach
customers, and who decides what. Technical terms are explained in the glossary
at the end.

## The three parts

Think of Cashpile like a shop:

- **GitHub** is the master copy of all the plans and instructions. Every change
  we make gets saved here, version by version. Ours is the repository
  `AxDevGrp/cashpile`.
- **Railway** is the building where the shop actually runs. It takes the
  instructions from GitHub, builds the live website, and serves it to people.
- **Supabase** is the filing cabinet in the back. It holds the real customer
  data — accounts, transactions, settings — and handles logging people in.

At runtime, the website talks to Supabase using a set of secret passwords
(URLs and keys) that are stored in Railway's settings, not in the code.

## The two layers that change

Every feature touches two separate layers, and they are updated by two separate
actions:

1. **The website** (buttons, screens, wording) — updated by saving to GitHub.
2. **The filing cabinet** (new tables, new columns, new data rules) — updated by
   a separate set of "change instructions" that someone runs on purpose.

Those change instructions are what we call a **migration**. It is just a written
list of changes such as "add this new drawer," "add this new column," "add this
rule." Migrations are **not** shipped by Railway. Railway only rebuilds the
website; it never touches the filing cabinet.

## The one rule that matters most

**Change the filing cabinet first, then the website.**

- If we update the website *before* the filing cabinet, the website asks for a
  drawer that does not exist yet and breaks.
- If we update the filing cabinet *first*, nothing breaks, because the changes
  are additions and the old website simply ignores the new drawers until we are
  ready to use them.

## What "pushing" means

"Pushing" means saving our changes from a computer up to GitHub. Because Railway
watches GitHub, **saving equals going live**. There is currently no separate
test building — the main copy is the real shop.

Because of that, we do not save to the main shared copy until a change has been
reviewed and tested. Work stays aside on its own copy until it is approved.

## The stages

The plan is broken into numbered stages because it is a big change. We do one
careful piece at a time and the owner approves each piece before the next.

- **Stage 00 — Take inventory.** Check the workshop, tools, and reference
  designs are in order. *Done and approved.*
- **Stage 01 — Filing-cabinet instructions.** Write the new tables and data
  rules the feature needs. *Instructions written; not yet run on the real
  filing cabinet.*
- **Stages 02–08 — Build the website.** The screens and behind-the-scenes logic
  that use those new drawers.
- **Stage 09 — Opening day.** Back up the filing cabinet, run the new
  instructions on it, put the new website live, and turn the feature on for a
  small group of test users first.

Nothing becomes visible to real customers until Stage 09, and only after the
owner gives the go-ahead.

## Who decides what

The owner (the "primary") makes three decisions, and nobody else should:

1. When the real filing cabinet is changed.
2. When new website code goes live.
3. When the feature is switched on for real users.

Everyone else prepares and tests the changes; the owner approves and releases.

## Where things stand right now

- Stage 00 is approved.
- Stage 01's filing-cabinet instructions are written and tested on a throwaway
  practice copy. They have **not** been run on the real Supabase.
- Nothing has been pushed live.
- The isolated test copy of the filing cabinet still needs to be set up so the
  Stage 01 instructions can be run on something safe, reviewed, and approved.

## Golden rules (short version)

1. Change the filing cabinet before the website, never the other way round.
2. Never run change instructions on the real customer data without the owner's
   approval and a backup.
3. Never save to the main copy until a change is reviewed — saving is going live.
4. Back up before any real change, and keep a way to undo it.
5. Turn new features on for a few test users first.

## Glossary

- **Repository (repo)** — the master folder of the project on GitHub.
- **Push** — save changes up to GitHub; with Railway watching, this also
  publishes the website.
- **Deploy** — build the website from the saved instructions and put it live.
- **Migration** — a written list of changes to the filing cabinet (new tables,
  columns, rules). Run on purpose; never shipped automatically.
- **Supabase** — the managed filing cabinet (database) and login system.
- **Railway** — the service that builds and runs the live website.
- **GitHub** — where the project's instructions and history are stored.
- **Isolated / test database** — a safe duplicate of the filing cabinet where
  changes can be practiced without touching real customer data.
- **Cohort / flag** — a switch that turns a new feature on for selected users
  (or everyone) without changing the code.
- **Primary** — the owner/approver who authorizes real changes and releases.

## See also

- `RAILWAY.md` — the hosting setup and the secret settings Railway needs.
- `docs/plans/cashboard-stages/README.md` — the stage-by-stage plan.
- `docs/plans/cashboard-stages/contracts.md` — the fixed rules the feature must
  follow.

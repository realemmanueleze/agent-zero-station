# Station rebuild

Branch: `ticket/t28-nango`  
Base: `dev` @ `c4ed1fa` (T27)  
Recorded: 2026-09-13, updated 2026-09-13 evening  
Constraint: fixtures and mocks only. No real sends, new vendor connections, publish, or production deploy.

Cathedral (approved 2026-09-16): land or kill this branch on `dev` before T32. Then T32 command API (three shapes, T3 200 replay) through T37 production, then Huffman/Carmen. See `tickets/README.md`.

Design read: command-station Operate UI for operators who approve parked drafts, warm paper / charcoal / copper, IBM Plex, high density, low motion. Not EEF Learn branding.

Confirmed design trio (Learn/PLAN.md:409):

- `/Users/thefacilitator/Documents/Learn/.agents/skills/emil-design-eng/SKILL.md`
- `/Users/thefacilitator/Documents/Learn/.agents/skills/design-taste-frontend/SKILL.md` (anti-slop + dials only; not landing-page layouts)
- `/Users/thefacilitator/Documents/Learn/.agents/skills/impeccable/SKILL.md` (Operate + harden + craft floor)

GStack used: context-restore, plan-eng-review, plan-design-review, review, qa. Engineering law: `docs/ENGINEERING.md`.

Dials: VARIANCE 3, MOTION 2, DENSITY 8. Approve / Edit / Kill and command palette do not animate.

## Validated findings

| Finding | Evidence | Verdict |
| --- | --- | --- |
| `useParkActions.ts` lacks fetch/JSON catch and `res.ok`; missing `state` falls back to `sent` on approve | was `apps/cockpit/src/ui/useParkActions.ts` lines 13–29 | Confirmed, fixed via `interpretParkAction` |
| `PacksDeck.tsx` hardcodes initial `sales` | was line 8; worker already `GET /packs` with `active` | Confirmed, fixed: `initialActive` from worker |
| `ConnectionView.tsx` uses `buildActivity(items)` (seeded logs) and only email gets `ParkQueue` | was lines 20–48 | Confirmed, fixed: ledger events + Slack HITL |

## Drive vs operator setup

Drive is a **deferred product feature**, not leftover operator setup. Day-one `ConnectionKind` is `email | slack | obsidian | db | mcp`. `createNangoSession({ kind: "drive" })` and `completeNangoConnection` for `google-drive` throw `connections.invalid`. `NANGO_INTEGRATION_DRIVE` is reserved only.

Operator-owned remains: `.env` secrets, Google/Slack/Nango vendor apps, Google OAuth verification (TODOS.md P2). No publish or production deploy in this rebuild.

## Completion matrix

| Unit | Status | Evidence |
| --- | --- | --- |
| 0 Audit recorded | done | this file; findings table above |
| 1 Baseline / T28 | done | T28 connect-only still green |
| 2 Shared UI + Action | partial | Desk strip + paper park card shipped; visual rebuild still needs a live pass on every screen |
| 3 Remaining screens | partial | Roster layout on Channels/Packs/Accounts; polish incomplete |
| 4 Runtime (Nango poll/send) | done under mocks | T30 + `nango.runtime` eval: proxy poll/send, two-account isolation, `send.provider_failed` stays parked, scoring turn cannot `commit_send` |
| 5 First-run / container | blocked | Not verified. Cursor shell runner stalled (see outcomes). Compose smoke script exists, not run |
| T31 desk behavior | blocked | Real Next + mock worker harness written. Playwright not run after runner failure |

## Test evidence

- `pnpm test` after T30/T31 first pass: **205 unit** + **30 recorded evals**
- T30: `tests/tickets/T30-nango-runtime.test.ts`, `evals/suites/nango.runtime.eval.ts`
- T31 jsdom: `apps/cockpit/src/ui/desk-behavior.test.tsx` (real `ParkQueue` / `PacksDeck` / `StationShell`)
- T31 browser: `tests/tickets/T31-desk-behavior.test.ts` against Next + `tests/helpers/mock-worker.ts`. Deleted `desk-fixture-server.ts` handwritten HTML

## Visual rebuild (this pass)

| Before | After | Why |
| --- | --- | --- |
| Three equal glance cards | Copper waiting count + source/ledger ticks | Anti-slop: no hero-metric trio |
| Fake close/nurture/park meters | Removed | Craft floor: no sparklines standing in for scores |
| Body radials + glass top bar | Flat paper / charcoal | Command desk, MOTION 2 |
| Uppercase kickers | Headings only | Craft floor ban; brief still names the desk |
| One 960px collapse | 720 mobile / 1100 tablet / desktop | Real breakpoints |
| Channel equal-card grid | Source roster rows | Same-size cards are not the page structure |

## Command outcomes (2026-09-14)

Cursor integrated-shell runner failed in this chat. Independent non-login shells on the same machine return immediately. Do not read empty long-running Cursor terminals as a slow Next compile.

| Call | Started (UTC) | Outcome |
| --- | --- | --- |
| `head` terminals (657880) | 04:54 | Still `running` ~30m, zero stdout, no pid in header |
| `ps \| rg` (657881) | 04:54 | Same |
| `/bin/echo` + `ps -p 71689` (657882) | 04:56 | Same |
| `printf` liveness | later | User stopped via Stop; no output |
| `/bin/bash --noprofile --norc -c 'printf LIVE'` (657884) | this turn | Bounded 12s; zero stdout; runner backgrounded. Verification not resumed |
| `pnpm --filter @station/cockpit build` (657872) | 01:37 | Terminal stuck at “Creating an optimized production build” with no further lines. Not treated as compile-time evidence |
| T31 / typecheck / Compose smoke | — | Not started after runner failure |

`next/font/google` was removed so a future build cannot block on fonts.googleapis.com. Fake `local("IBM Plex")` faces were removed; tokens now name Segoe UI / system-ui until SIL OFL woff2 files are bundled.

Stalled diagnostic terminals to Stop in the UI (no pid to signal without a live runner): 657880, 657881, 657882. Did not pkill Learn or other apps.

## Hard line

Model cannot `commit_send`. Approve is the only send. Keep test classes `park-card`, `hitl`, `inbox`, `quiet-pill`, `pack`.

This rebuild is not complete while T31 Playwright, cockpit typecheck, production build, Compose fixture smoke, and the multi-screen visual pass are unverified.

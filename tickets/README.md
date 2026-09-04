# Tickets

Each ticket is a PR-train slice. Spec first, failing suite second, program third.

| Ticket | Outcome | Executable tests | Merge-gate evals |
| --- | --- | --- | --- |
| T0 | `StationError` + JSON logger | `packages/observability/src/observability.test.ts` | none |
| T1 | Ledger, leases, claims, fixture upsert | `tests/tickets/T1-schema.test.ts` | `evals/suites/schema.fixture-upsert.eval.ts` |
| T2 | Worker bind, token, claim, lease | `tests/tickets/T2-worker.test.ts` | `evals/suites/worker.claim.eval.ts` |
| T3 | Idempotent Approve | `tests/tickets/T3-send.test.ts` | `send.park-then-approve`, `send.must-not-autonomous` |
| T4 | Cockpit proxy + password | `tests/tickets/T4-cockpit.test.ts` | `evals/suites/cockpit.park-list.eval.ts` |
| T5 | Config + policy | `tests/tickets/T5-config.test.ts` | `evals/suites/policy.mcp-deny-send.eval.ts` |
| T6 | Pack.draft + replay CI | `tests/tickets/T6-replay.test.ts` | `replay.sales-week`, `replay.pack-switch` |
| T7 | Microsoft Graph channel | `tests/tickets/T7-graph.test.ts` | `evals/suites/graph.park-then-approve.eval.ts` |
| T8 | First run: `pnpm dev` parks a fixture | `tests/tickets/T8-first-run.test.ts` | `evals/suites/first-run.park.eval.ts` |
| T9 | Next.js cockpit primitives | `tests/tickets/T9-cockpit-next.test.ts` | `evals/suites/cockpit.next-park.eval.ts` |
| T10 | Postgres SQL + packs + scoring loop | `tests/tickets/T10-spine.test.ts` | pack-switch eval stays green |
| T11 | Email channel + fail-stays-parked | `tests/tickets/T11-email.test.ts` | `evals/suites/email.park-then-approve.eval.ts` |
| T12 | `/accounts` and `/packs` | `tests/tickets/T12-cockpit-pages.test.ts` | `evals/suites/cockpit.accounts-packs.eval.ts` |
| T13 | License, docs, Compose, smoke | `tests/tickets/T13-ship-kit.test.ts` | compose smoke |
| T14 | Unified action deck + channel drill-down | `tests/tickets/T14-command-deck.test.ts` | `evals/suites/cockpit.command-deck.eval.ts` |
| T15 | Encrypted Add source for every kind | `tests/tickets/T15-connections.test.ts` | `evals/suites/connections.add-source.eval.ts` |
| T16 | Vault + park survive restart | `tests/tickets/T16-persist.test.ts` | `evals/suites/persist.restart.eval.ts` |
| T17 | Continuous email poller | `tests/tickets/T17-email-poller.test.ts` | `evals/suites/email.poller.eval.ts` |
| T18 | Deep Agents live tool table | `tests/tickets/T18-deep-agents.test.ts` | `evals/suites/loop.deep-agents.eval.ts` |
| T19 | Microsoft Graph live poll and send | `tests/tickets/T19-graph-live.test.ts` | `evals/suites/graph.live.eval.ts` |
| T20 | Slack, vault, pack SQL, MCP live adapters | `tests/tickets/T20-live-adapters.test.ts` | `evals/suites/adapters.live.eval.ts` |
| T21 | Activity and Brief read the ledger | `tests/tickets/T21-ledger-cockpit.test.ts` | `evals/suites/cockpit.ledger-views.eval.ts` |
| T22 | Learning proposals, fail-closed | `tests/tickets/T22-learning.test.ts` | `evals/suites/learning.proposals.eval.ts` |
| T23 | Fly + GHCR on tag | `tests/tickets/T23-dist.test.ts` | `evals/suites/dist.release.eval.ts` |
| T24 | Public privacy page | `tests/tickets/T24-privacy.test.ts` | `evals/suites/privacy.page.eval.ts` |

Branch history for T3 (and every later ticket):

```
test(T3): failing sendId and double-Approve cases
eval(T3): recorded send traces
feat(T3): make Approve idempotent
```

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

Branch history for T3 (and every later ticket):

```
test(T3): failing sendId and double-Approve cases
eval(T3): recorded send traces
feat(T3): make Approve idempotent
```

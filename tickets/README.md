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
| T25 | Boot starts live email producers | `tests/tickets/T25-boot-producers.test.ts` | `evals/suites/boot.producers.eval.ts` |
| T26 | Activity and Brief pages hit the worker | `tests/tickets/T26-cockpit-ledger.test.ts` | `evals/suites/cockpit.worker-views.eval.ts` |
| T27 | Live tools run on inbound park | `tests/tickets/T27-live-tools.test.ts` | `evals/suites/loop.live-tools.eval.ts` |
| T28 | Nango Connect for Gmail and Slack | `tests/tickets/T28-nango.test.ts` | `evals/suites/nango.connect.eval.ts` |
| T29 | Station rebuild: park errors, packs active, ledger HITL | `tests/tickets/T29-rebuild.test.ts` | `evals/suites/cockpit.rebuild.eval.ts` |
| T30 | Nango Gmail/Slack poll and approved send | `tests/tickets/T30-nango-runtime.test.ts` | `evals/suites/nango.runtime.eval.ts` |
| T31 | Desk behavioral HITL, viewport, themes | `tests/tickets/T31-desk-behavior.test.ts` | `evals/suites/cockpit.rebuild.eval.ts` |
| T32 | Command API freeze: three shapes, T3 200 replay, inbound control-plane | `tests/tickets/T32-command-api.test.ts` | `evals/suites/command.api.eval.ts` |
| T33 | Absorbed into T46, T47, and T52. Do not open a separate PR | `tests/tickets/T33-hooks-and-dial.test.ts` | `evals/suites/loop.deep-agents.eval.ts` |
| T34 | Absorbed into T48 | `tests/tickets/T34-records.test.ts` | `evals/suites/records.lead-upsert.eval.ts` |
| T35 | Absorbed into T49 | `tests/tickets/T35-context.test.ts` | `evals/suites/context.must-not-leak.eval.ts` |
| T36 | Absorbed into T54 | `tests/tickets/T36-observer-runs.test.ts` | `evals/suites/observer.spend.eval.ts` |
| T37 | Absorbed into T41–T45. Do not invent the Unseen fixture lines | `tests/tickets/T37-unseen-inbound.test.ts` | `evals/suites/unseen.inbound.eval.ts` |
| T38 | Absorbed into T53 | `tests/tickets/T38-transcripts-open-work.test.ts` | `evals/suites/transcripts.open-work.eval.ts` |
| T39 | Held. Huffman waits for a dated deploy | `tests/tickets/T39-huffman-desk.test.ts` | `evals/suites/huffman.phone.eval.ts` |
| T40 | Held. Carmen waits for a signed Phase 2 | `tests/tickets/T40-carmen-engine.test.ts` | `evals/suites/carmen.engine.eval.ts` |
| T41 | LangGraph run, Postgres checkpoint, pause before send | `tests/tickets/T41-rail-checkpoint.test.ts` | `evals/suites/rail.checkpoint.eval.ts` |
| T42 | Park slip resumes the graph. Approve sends once | `tests/tickets/T42-rail-park.test.ts` | `evals/suites/rail.park.eval.ts` |
| T43 | Reply or form resumes the same run | `tests/tickets/T43-rail-reply.test.ts` | `evals/suites/rail.reply.eval.ts` |
| T44 | Silence timer parks a follow-up and does not send | `tests/tickets/T44-rail-timer.test.ts` | `evals/suites/rail.timer.eval.ts` |
| T45 | Booked, objection, and silence branch to a parked draft | `tests/tickets/T45-rail-branches.test.ts` | `evals/suites/rail.branches.eval.ts` |
| T46 | Deep Agents drafts inside three nodes. Filesystem tools stay denied | `tests/tickets/T46-deep-agent-draft.test.ts` | `evals/suites/loop.deep-agents.eval.ts` |
| T47 | Dial parks, holds, or denies. It does not send | `tests/tickets/T47-dial-policy.test.ts` | `evals/suites/rail.dial.eval.ts` |
| T48 | Record kind plus a named actor. Webhook upsert does not send | `tests/tickets/T48-context-records.test.ts` | `evals/suites/records.lead-upsert.eval.ts` |
| T49 | Draft reads that tenant's record only | `tests/tickets/T49-context-read.test.ts` | `evals/suites/context.must-not-leak.eval.ts` |
| T50 | LangSmith trace link when a key exists. No new organization | `tests/tickets/T50-trace-link.test.ts` | `evals/suites/rail.trace.eval.ts` |
| T51 | Activity shows the run phases in the existing sentences | `tests/tickets/T51-run-timeline.test.ts` | `evals/suites/rail.timeline.eval.ts` |
| T52 | Swapping the drafter keeps pause, one send, and the same run | `tests/tickets/T52-agent-swap.test.ts` | `evals/suites/rail.swap.eval.ts` |
| T53 | Labeled transcripts and parked open work | `tests/tickets/T53-transcripts-audit.test.ts` | `evals/suites/transcripts.open-work.eval.ts` |
| T54 | Spend meter. The observer cannot send | `tests/tickets/T54-spend-meter.test.ts` | `evals/suites/observer.spend.eval.ts` |
| T55 | Held. Drive stays deferred | `tests/tickets/T55-drive-connector.test.ts` | none |
| T56 | Held. Second client space waits for a date | `tests/tickets/T56-client-space.test.ts` | none |
| T57 | Held. No evals-admin screen | `tests/tickets/T57-evals-desk.test.ts` | none |

Rail loop, one PR at a time, review, then `dev`, then the next ticket: T41 → T42 → T43 → T44 → T45 → T46 → T47 → T48 → T49 → T50 → T51 → T52 → T53 → T54. The loop skips T39, T40, T55, T56, and T57. T33–T38 are absorbed by that train and are not separate PRs. T3 send-once (200 replay, one provider call) must survive every ticket. Model tools never include `commit_send`.

Branch history for T3 (and every later ticket):

```
test(T3): failing sendId and double-Approve cases
eval(T3): recorded send traces
feat(T3): make Approve idempotent
```

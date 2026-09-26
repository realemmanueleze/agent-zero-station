# System design

Status: current as of 2026-09-26.  
Repo: `realemmanueleze/agent-zero-station` (this tree is not [frdel/agent-zero](https://github.com/frdel/agent-zero)).  
Approved behavioral contract: [docs/designs/kit-contract.md](designs/kit-contract.md).  
Earlier product picture (4 Sep 2026): [docs/designs/agent-zero-station-kit.md](designs/agent-zero-station-kit.md). Where the two disagree, the kit contract and the code win.

This note answers the system-design questions for the station: what it is, how a turn runs, how agents are meant to run, and how context, memory, learning, storage, scale, traffic, security, deployment, and the harness are treated. Each section says what is **shipped** in this tree and what is **planned** and still paused.

## What we are building

An open-source command station a studio clones, connects to its own mail and tools, restyles, and runs as one container. The station drafts. A person approves. The same image runs on a laptop and in the cloud.

The product is the spine, not the sales pack. `packs/sales` is an example. A client install plugs and unplugs connectors and packs behind a stable HTTP API. There is no hosted SaaS and no shared OAuth app.

The narrowest wedge, from the approved contract, is one inbound run: a message parks, a person approves, the provider is called once, and a reply on the same thread resumes that same run. Unseen Engine is the proving install. Huffman’s phone desk (T39) and Carmen’s trip engine (T40) are later installs, each in its own data space, and only after that proving run exists and that install has a date.

## Requirements we locked

| Question | Answer |
| --- | --- |
| Who is the user? | The studio operator, then a forker. Client UIs are overlays on the park API. |
| What must never happen? | The model sends. A second Approve calls the provider again. Tenant A’s draft sees tenant B. A sent message is pretended undone. |
| What is the success path? | Inbound parks. Approve sends once. A reply parks the next draft on the same `runId`. |
| What is in v1 scale? | One worker, one ledger writer, pollers, a human park queue. |
| What waits for a real failure? | Brokers, dead-letter queues, circuit breakers, a second availability zone, a second worker. |
| How do we know it works? | A failing test or eval exists before the program that turns it green. |

## Trust boundaries

```
Browser  --password if off localhost-->  Cockpit :19173
                                              |
                                    control token (server-side)
                                              |
                                         Worker 127.0.0.1:19174
                                              |
                         +--------------------+--------------------+
                         |                    |                    |
                    Postgres ledger     Provider (mail/Slack)   Pack SQL
                    (station catalog)                        (separate catalog)
```

- The browser never holds `STATION_CONTROL_TOKEN`, the master key, or plaintext connector secrets.
- The worker binds `127.0.0.1` only. Compose does not publish port 19174.
- The cockpit proxies Approve, Edit, Kill, and OAuth completion.
- Nango’s webhook is the one cockpit route allowed without the desk password. The route checks the HMAC.
- `POST /park/:id/receipt` is control-token only. The cockpit has no button for it.

## Processes and how they start

One OCI image (`Dockerfile`, Node 22). `CMD` is `pnpm dev`, which runs two processes in that container:

| Process | Package | Bind | Role |
| --- | --- | --- | --- |
| Worker | `apps/worker` → `@station/runtime` → `@station/api` | `127.0.0.1:19174` | Producers, ledger, park, send, context API |
| Cockpit | `apps/cockpit` (Next.js 15) | `:19173` (`0.0.0.0` inside the image) | Desk UI and API proxies |
| CLI | `apps/cli` | none | Recorded replay bench. In-process station, no HTTP |

Local Compose (`compose.yml`) adds Postgres 16 for the station catalog and a second Postgres for pack SQL. The cockpit is published on `127.0.0.1:19173`. Postgres is published on `127.0.0.1:5435`.

Ports override with `STATION_COCKPIT_PORT` and `STATION_WORKER_PORT`.

## What an “agent” is

**Shipped.** There is one worker process and an in-memory `Station` (`packages/station/src/station.ts`). The workflow run is a LangGraph. `@station/loop` depends on `@langchain/langgraph`. Deep Agents, LangChain, and LangSmith are not dependencies yet. Tables `da_checkpoints` and `da_writes` exist and this graph does not write them. The rail checkpointer is in-memory for the engine tests.

A live inbound turn:

1. On listen, the worker starts producers (`startLiveProducers`). A mailbox that becomes live after boot starts its producer immediately. Inbound parks without a restart.
2. Each producer polls on `STATION_POLL_MS` (default 30s). A lease heartbeat is 30s. A held lease returns `lease.held`.
3. `pollAccount` yields a signal. `runLiveTurn` (`packages/loop`) runs the active pack: `score` → `draft` → `beforePark`.
4. The decision is `parked`, `dropped`, or `escalated`. Nothing is sent.
5. The person uses Approve, Edit, or Kill on the cockpit. Approve is the only path that calls a provider.

Without a model key, `runLiveTurn` is `Pack.draft` plus `beforePark`. Recorded replay is model-free: `normalize → pack.score → draft → beforePark` on a frozen fixture, compared on `{ state, draftBody, tenantId }`.

The live tool table (`packages/loop/src/tools.ts`) is fixed:

`read_signal`, `search_ledger`, `draft_reply`, `query_db`, `vault_search`, `escalate`, `drop`.

`commit_send` is absent. `liveToolsIncludeCommitSend()` is false. Model tools never include it. MCP tools that look like send, mail, post, or write are denied (`DENY_MCP`).

**Shipped.** The run is a LangGraph in `packages/loop/src/rail.ts`. State carries the mailbox, thread, draft, approval, and send count. The graph drafts, pauses at `human_review`, sends only after Approve, then pauses at `wait_for_reply`. A reply resumes that same run and parks the next draft. Kill before send does not call the provider. A second Approve while the run is waiting does not send again.

Deep Agents is the draft step inside that graph and is not installed yet. The stock agent ships filesystem tools this station denies (`write_file`, `execute`, and the rest). Until that deny list is the tool table, the draft nodes use `pack-unseen-engine`. The model still never sends.

The ledger `outbox` and `waits` remain the send-once gate for the desk Approve button. The rail is the workflow around that gate. Huffman and Carmen are not part of this graph.

## The harness

“Harness” in this repo means three different things. Only the first two run today.

### 1. Runtime harness (shipped)

The worker plus `@station/loop` is the harness:

- Packs supply the objective (`score`, `draft`, `beforePark`).
- The tool table is the only way a turn touches ledger, vault, or pack SQL.
- Isolation and “do not send” are TypeScript, not model judgment. `buildLivePrompt` keeps ledger hits whose `tenantId` matches the turn.
- `send.approve` on the worker is the only function that calls transport. `send.commitSend` and `graph.commitSend` record identity and do not call the provider.

### 2. Evaluation harness (shipped)

This is how behavior is allowed to change. [docs/ENGINEERING.md](ENGINEERING.md):

| Kind | Lives in | Proves | May call a model |
| --- | --- | --- | --- |
| Test | `*.test.ts`, `tests/tickets/` | Contracts, errors, isolation, HTTP, SQL | No |
| Eval | `evals/suites/*.eval.ts` | Draft quality, park vs drop, pack switch | Yes, or a recorded trace |

Ticket order is spec (`tickets/T<n>-<slug>/tests.md` and `evals.md`), then a red suite, then the minimum program. CI merge gates are recorded replay, isolation, double-Approve, and compose smoke. Live-model evals are `gate: nightly` and are not wired (`pnpm eval:live` exits 0).

UI tests hit the real Next cockpit with an isolated mock worker (`tests/helpers/mock-worker.ts`, `tests/helpers/next-cockpit.ts`) or jsdom desk tests. Handwritten HTML fixtures are not the proof.

### 3. Model harness (planned)

The 4 Sep design named Deep Agents as the loop harness, with `directives.md` as the skill. The kit contract kept the ledger as the send-once gate. On 2026-09-26 the run itself became the LangGraph in `packages/loop/src/rail.ts`: pause for approval, send once, wait for a reply, resume the same run. Deep Agents stays the draft plug and is not pinned until its default filesystem tools are denied.

## Park, send, waits

The graph host is two ledger tables, `waits` and `outbox`, plus `decisions.send_id` unique. It is not a new runtime. State machine: `packages/station/src/kit-ledger.ts`.

```
inbound
  → parked decision, new runId
  → (no outbox, no wait)

Approve
  → outbox queued, receipt null
  → provider called once
  → receipt stored while still queued
  → outbox sent + one open reply wait
  → desk: "Sent. Watching for a reply."

reply on (mailboxId, threadId)
  → that wait becomes resumed
  → next draft parks on the same runId
  → no send

Kill
  → decision dropped, outbox killed, open waits dead, lease released
  → a later Approve is send.killed
```

Outbox states: `queued`, `sent`, `parked_failed`, `killed`.  
Wait states: `open`, `dead`, `resumed`. Wait reasons: `reply`, `timer`.

Rules that define correctness:

- Approve is the only insert into `outbox`.
- A second Approve on `sent` is HTTP 200 and does not call the provider (T3 send-once).
- A second Approve on `parked_failed` is 409 `send.already_attempted`. Recovery is a new draft and a new `send_id`.
- A second Approve on `queued` with a null receipt is 409 `send.in_flight`.
- Provider failure stores no receipt, sets `parked_failed`, `attempts = 1`, leaves the decision parked, opens no wait, returns `send.provider_failed`.
- Edit `{ body }` is allowed only while no outbox row exists. After that, Edit is 409.
- At most one open reply wait per `(mailboxId, threadId)`. A conflict is `run.wait_conflict`. The decision stays `sent`. There is no second provider call.
- A `resumed` wait does not reopen. The next successful send creates a new wait row.
- Passing a prior run’s state in as a new invocation is forbidden. That would mint a second `runId`.
- A timer is the same `waits` row with `reason = timer`. When `wake_at` passes, the worker drafts and parks. It does not send. The proving path creates no timer row.
- Kill after the provider has accepted cannot pull the message back. Rollback after send is a new parked draft.
- While a send is in flight, the slip stays in Needs you. Kill stays available. Approve and Edit are disabled. The action tick is one word: Parked, Sending, Sent, or Killed.

Boot scan runs on worker start and when a mail poll finishes. It is not an HTTP route.

- `queued` and no receipt: log `send.in_flight` at warn. Do not call the provider.
- `queued` plus a receipt and a live decision: mark `sent`, open the reply wait, no provider call.
- Killed decision: do not mark `sent` and do not open a wait.

If the process dies after the provider accepts and before `receipt` is stored, the operator posts the provider message id to `POST /park/:id/receipt`. That route writes the receipt and does not call the provider. The boot scan then completes `sent`. If no sent message exists, Kill, and the next send is a new draft.

`GET /park` keeps the names `id`, `state`, `actions`, `body`. Additive fields a current cockpit may ignore: `runId`, `wait`, `outbox`.

Desk copy is part of the contract. Activity, Brief, and connection lists use the same ledger sentences as Action. After Approve the sentence is “Sent. Watching for a reply.”

## Connectors

Day-one kinds: email (unbounded mailboxes), Slack, Obsidian, a database, and MCP. Google Drive is deferred.

| Kind | How it connects | How it sends |
| --- | --- | --- |
| Email | IMAP/SMTP fields, Gmail OAuth, or Nango | `approveWithConnection` after Approve |
| Slack | Slack OAuth or Nango | Nango send path. A non-Nango Slack send is `connections.invalid` |
| Microsoft Graph | `STATION_GRAPH_*` | `graph.commitSend` does not call transport. Approve does |
| Obsidian | Vault root `STATION_VAULT_ROOT` | Read in the turn (`vault_search`). No send |
| Database | `PACK_DATABASE_URL`, separate catalog | Read-only `query_db` |
| MCP | Allowlist `config.mcpAllowed`, default deny | Send-like tool names denied |

OAuth callbacks live on the cockpit (`/oauth/google/*`, `/oauth/slack/*`), not on the worker. The cockpit redirects the code exchange to the worker with the control token. PKCE state is held in the single worker’s memory. One `GOOGLE_OAUTH_CLIENT_ID` is the station’s Google app and can authorize many Gmail accounts. Accounts stay isolated.

Nango is the Gmail/Slack connect and runtime layer: browser OAuth, inbound poll, and operator-approved send. Failed send stays parked. The worker never sends on its own.

`/channels` is Add source (pick the kind). `/channels/email` is Add email, not a generic source form. Connecting an account never sends.

A parallel module, `packages/station/src/workflow.ts`, scans Gmail on a timer and can POST hits to a webhook. That desk is not the park graph host. Kit waits remain the pause/resume log for approved sends.

## Context and memory

**Shipped.** Table `records` (`id`, `tenant_id`, `body`) in `migrations/003_kit.sql`. `station.kit.readContext` / `writeContext` filter by `tenantId`. Hydrate and flush go through `persist-sql.ts`. A T32 test checks that a read for tenant A returns nothing stored for tenant B.

**Planned.** The draft step is supposed to read that tenant’s records in process. Today `readContext` is the API and the test; inbound park does not yet load records into the draft. T34 adds `kind` (lead, traveler, job, client), a named actor, and webhook upsert. T35 attaches ledger rows, inbound, and edits to a `recordId` and builds few-shot context per record, with the same must-not-leak rule. Both tickets are `it.skip`. Their eval files are specified and not in `evals/suites/` yet.

Secrets are not context. They stay in encrypted `connections` and never enter prompt text.

There is no context-hub screen. A screen would be a later overlay.

Instructions for a pack, once learning is in use, live in `directives.md`. That file is human-edited. See Learning.

## Learning

**Shipped.** `packages/station/src/learning.ts` writes a proposal under `packs/<packId>/proposals/`. Outcome kinds the renderer knows: `sent`, `killed`, `human_label`, `vault_note`. The job never auto-merges into `directives.md`. T22 tests and `learning.proposals.eval.ts` cover that fail-closed behavior.

**Planned, not fully wired.** [docs/LEARNING.md](LEARNING.md) describes a 03:00 local job that reads an `outcomes` table. There is no `outcomes` table in `migrations/`. There are no embeddings. Empty days are supposed to still write a file so a miss is visible. Cron is not wired.

Learning is a proposed diff a person applies. It is not a hidden weight update and it does not change the send gate.

## Storage

Two catalogs, never the same database:

| URL | Holds |
| --- | --- |
| `STATION_DATABASE_URL` | Ledger and vault: signals, claims, leases, decisions, connections, outbox, waits, records |
| `PACK_DATABASE_URL` | Optional pack SQL. Read by `query_db` |

Migrations `001_ledger.sql`, `002_connections.sql`, `003_kit.sql` apply in order when the station URL is real Postgres. `memory://` and placeholder URLs skip SQL (tests).

The process keeps maps in `ledger.ts`, keyed by database URL, and hydrates/flushes through `persist-sql.ts`. Restart on the same catalog keeps Add source accounts and parked cards (T16).

`/data` is the writable volume for local files (proposals, fixtures, vault files). Compose mounts `./data:/data`.

Encryption at rest applies to connector credentials: AES-256-GCM, AAD `id|tenantId|kind`, key `STATION_MASTER_KEY` (32 bytes in production). `STATION_MASTER_KEY_PREV` decrypts during rotation (`envelope.ts`, `keys.ts`). Decision bodies, signal payloads, `records.body`, and outbox metadata are plaintext in Postgres. Treat the database volume as trusted disk.

The 4 Sep design named SQLite and one writer. The running tree is Postgres. The one-writer rule still holds: one worker owns the ledger.

## Scale, traffic, and durability

Designed for one station per client space, not a multi-tenant SaaS.

| Area | This design | Upgrade, when one worker is not enough |
| --- | --- | --- |
| Durable state | Ledger rows: decision, wait, outbox | A workflow engine or a Kafka log |
| Replay | Unique `send_id`. Approve calls the provider once per id | A graph library that re-runs a paused node from the top |
| Faults | `parked_failed`, `attempts = 1`. `lease.held` is 409 | Jittered backoff, circuit breakers, a second zone, bulkheads |
| Queue | The park queue is the human queue. The worker polls open waits and mailboxes | A broker in front of the worker |
| Streaming | `GET /park` reads rows | Token streams, backpressure, chunk limits |
| Cancel | Kill on this worker | A distributed cancel context |
| Dead letters | Not provisioned. The attempt count that should alert is unset | A DLQ once an operator has lost a send and picks that count |
| Capacity (early note) | One worker, on the order of 25 live mail producers | A second worker, which needs a different writer story |
| Traffic shape | Poll every 30s per producer, plus human Approve bursts | Push webhooks as the primary ingest, if poll lag becomes the problem |

Heartbeats log at `debug`. A poll tick does not log at `info`.

Idempotency is the scale strategy we actually built: unique `send_id`, unique open reply wait, 200 replay, boot scan that finishes `queued`+receipt without a second provider call.

## Security

| Control | Behavior |
| --- | --- |
| Worker network | Bind `127.0.0.1` only. LAN clients are rejected (T2) |
| Desk auth | Localhost is open. Off-box needs `STATION_COCKPIT_PASSWORD` (`/login`) |
| Control plane | `Authorization: Bearer ${STATION_CONTROL_TOKEN}` on worker routes except health |
| Secrets | Encrypted connections. Master key required in production config load |
| Logs | JSON only, via `@station/observability`. Redact master key, control token, cockpit password, Nango secrets, `Authorization`, raw mail bodies, credential-shaped pack SQL |
| Errors | Throw only `StationError`. Clients see `{ error: { code, message, requestId } }`. No stacks |
| Send | Approve only. In-flight send can be killed. Model and MCP cannot commit a send |
| OAuth | Cockpit callback, worker exchange, PKCE in one process |
| Privacy | [docs/PRIVACY.md](PRIVACY.md). No author analytics. No shared Google or Slack app. The host of the container is the operator |
| Tenancy | `tenantId` is the isolation boundary (mailbox, workspace, or vault id). A workspace tenant across producers is optional. Isolation is enforced below the model |

Policy and config are a ticket of their own (T5): MCP allowlist, redacted config dump, production refusal to boot without a master key.

## Observability

`packages/observability`:

- `StationError` with a stable `code` (`send.provider_failed`, `lease.held`, `invariant.*` for programmer mistakes at status 500).
- JSON lines. Required fields: `level`, `msg`, `time`, `service`, `requestId`. Add `tenantId`, `signalId`, `decisionId`, `producer` when known.
- Levels: `debug` (off in prod, heartbeats), `info` (claimed, parked, sent), `warn` (retryable, including `send.in_flight` on boot scan), `error` (non-retryable).

A LangSmith organization is a later per-deploy choice. This design does not provision one. A trace id may be stored on a run later.

Spend metering (50 / 80 / 100) is T36, after the first run, and paused. The desk reserves a tick for it (`$42 of $100` in the design notes). It is not part of the first eval.

## Cockpit

Source of truth for look and behavior: [docs/DESIGN.md](DESIGN.md).

One screen for everything that needs a person. Persistent nav: Action, Channels, Activity, Brief, Packs. Accounts and Privacy sit under the nav. Action is a three-column desk: sources, parked slips, this turn. Channels drills into a kind, then a connection, and uses the same Approve / Edit / Kill queue.

Theme follows the OS, with an explicit light, dark, and high-contrast override. Packs recolor CSS tokens (`--ink`, `--park-border`, and the rest). They do not inject HTML and they cannot hide Approve, Edit, or Kill. Fonts are bundled files or an honest system fallback. Do not use `local()` IBM Plex.

Every surface has loading, error, empty, and ready. Errors use `role="alert"`. Empty copy says what to do next. Activity and Brief read ledger rows. They do not invent a brief.

## Deployment and how a station runs

Checklist: [docs/DEPLOY.md](DEPLOY.md).

| Host | How |
| --- | --- |
| Laptop | Node 22, `pnpm i`, copy `.env.example` to `.env`, `pnpm dev`. Open `http://127.0.0.1:19173/` |
| Compose | `docker compose up`. Same URL. Fixture smoke: `pnpm smoke:compose` on `127.0.0.1:29173` |
| Linux VM | Docker, Caddy for TLS, `STATION_PUBLIC_URL=https://<host>`, disk for `/data`, cockpit password |
| Fly.io / Railway | One service from the Dockerfile, a volume, secrets. Tag pushes publish `ghcr.io/<owner>/<repo>:<tag>` (T23) |
| Cloud Run | Poor fit unless the volume is actually durable. Prefer a VM, Fly, or Railway for the ledger |

Required secrets in a real deploy: `STATION_MASTER_KEY`, `STATION_CONTROL_TOKEN`, and `STATION_COCKPIT_PASSWORD` when the desk is off localhost. Add Google, Slack, or Nango secrets only for the connect path you use. Compose’s dev key and token are for local Postgres, not production.

Branches: `dev` is staging (open PRs here). `main` is production.

A second client does not fork the servers. They pin an image tag after that deploy’s evals pass, with their own database and, later, their own LangSmith org. Splitting this repo into a UI repo and a server repo waits until a second client space has a date. Until then, one repo, one image, cockpit included.

## Multi-tenant and kit versus client

| Surface | Owner |
| --- | --- |
| Connectors, encrypted vault, ledger, outbox, waits, records, Approve | Kit. Versioned with the image |
| Pack (`score` / `draft` / `beforePark`) and theme CSS | Client overlay, shipped as a pack in this repo until a second space exists |
| Park UI | Kit cockpit today. A client UI may replace it and still call `GET /park` |
| Data | Per deploy. One database is not shared across Huffman, Carmen, and Unseen |

`tenantId` isolates rows inside one deploy. Separate deploys isolate clients. The model is not the isolation boundary.

## Data model

`001_ledger.sql`

- `signals` — id, fixture, tenant, payload
- `claims` — which pack and worker claimed a signal
- `leases` — producer ref, worker, heartbeat
- `decisions` — park state, body, unique `send_id`
- `da_checkpoints`, `da_writes` — unused placeholders

`002_connections.sql`

- `connections` — tenant, kind, account, status, encrypted credential envelope
- decision columns for account, kind, send-to

`003_kit.sql`

- `outbox` — `send_id`, `run_id`, decision, state, attempts, receipt, provider thread id
- `waits` — run, tenant, mailbox, thread, reason, `wake_at`, state; one open reply per mailbox and thread
- `records` — id, tenant, body
- decision columns for run, mailbox, thread, producer, kill phase

## Folder structure

```
apps/cli          recorded replay
apps/worker       process entry, loads .env, starts the worker
apps/cockpit      Next.js desk, proxies, OAuth and Nango routes

packages/observability   StationError, JSON logger, redaction, error codes
packages/station         @station/api — ledger, HTTP, send, connections, kit, learning
packages/loop            pack turn and the live tool table
packages/packs           sales and inbox-triage
packages/channels        email, Graph, Slack, MCP / SQL / vault adapters
packages/runtime         startWorker and the listen/boot hook

migrations/       Postgres, applied in filename order
evals/suites/     recorded and live-shaped evals
tests/tickets/    T1–T40 contract tests
tests/helpers/    mock worker and real Next cockpit
tickets/          spec for each ticket (tests.md, evals.md)
fixtures/         frozen replays, including sales-week
packs/            pack assets (themes, proposal output)
docs/             engineering law, deploy, privacy, designs
```

New station behavior prefers a module beside `station.ts` (`kit-ledger.ts`, `workflow.ts`, `persist-sql.ts`) over growing the orchestrator further.

## Programming paradigms

- **Language.** TypeScript, ESM (`"type": "module"`), pnpm workspaces, Node 22.
- **Spec first.** A ticket is a written contract, then a red test, then the smallest program. Refactor only while green.
- **Typed failures.** One error type. Stable codes. HTTP status lives on the error. Catches at the worker and cockpit edges map to client JSON or rethrow. A catch that swallows is a bug.
- **Explicit state machines.** Decision, outbox, and wait states are unions. Switches end in a `never` check so a new state fails the build until it is handled.
- **Strategy objects for behavior that clients swap.** A pack is three functions. A channel is a send function the worker calls after Approve. MCP is a tool policy, not a producer.
- **Ledger as the log.** Producers append signals. The loop reads the ledger. The model does not call providers except through the tool table, and that table cannot send.
- **Human-in-the-loop as the control plane.** Approve, Edit, and Kill are the API. Autonomy stops at a parked draft.
- **Fail closed.** Unknown MCP send tools deny. Provider failure stays parked. Learning proposes and does not merge. A killed outbox cannot be approved again.
- **Pause and resume are a LangGraph run.** The ledger outbox is still the send-once gate. The graph pauses at human review and at a reply wait. Deep Agents drafts inside three nodes and cannot send.
- **UI.** React server and client components in the App Router. Desk state is derived from the worker ledger, not a second store. Theme is CSS variables.

## Ticket map (rail train)

Shipped through the connect, desk, and kit-send work: T0–T32, including outbox, waits, records, and boot scan.

The build loop is T41–T54. Each ticket is its own PR: red suite, program, review, merge to `dev`, then the next ticket. T39, T40, T55, T56, and T57 are held and are not opened. T33–T38 are absorbed into the train and are not separate PRs.

| Ticket | Intent |
| --- | --- |
| T41 | LangGraph run. Checkpoint in Postgres. Pause before any send |
| T42 | The park slip resumes the graph. Approve sends once |
| T43 | A reply or a form event resumes the same `runId` |
| T44 | A silence timer parks a follow-up and does not send |
| T45 | Booked, objection, and silence each park a draft |
| T46 | Deep Agents drafts inside three nodes. Filesystem and send tools stay denied |
| T47 | Dial parks, holds, or denies. It does not send |
| T48 | Record kind and a named actor. A webhook upsert does not send |
| T49 | The draft reads that tenant's record only |
| T50 | A LangSmith trace link when a key exists. No new organization |
| T51 | Activity shows the run in the existing ledger sentences |
| T52 | Swapping the drafter keeps the pause, one send, and the same run |
| T53 | Labeled transcripts and parked open work |
| T54 | Spend meter. The observer cannot send |
| T55 | Held. Drive stays deferred |
| T56 | Held. A second client space waits for a date |
| T57 | Held. No evals-admin screen |
| T39 | Held. Huffman waits for a dated deploy |
| T40 | Held. Carmen waits for a signed Phase 2 |

T3’s send-once rule (200 replay, one provider call) must survive every later ticket.

T3’s send-once rule (200 replay, one provider call) must survive every later ticket.

## Open questions (left open on purpose)

- The `parked_failed` attempt count that should alert. Pick it when an operator has lost a send.
- Whether due timers use the 30s mail poll or their own interval. The contract does not lock the number. Workflow chat uses a 15s timer in `station.ts`; that is a separate desk.
- LangSmith org per later deploy. Not provisioned.
- The real Unseen Engine fixture: mailbox, thread id, and the sentence a wrong send would create. The first run stays short of that fixture until those three lines exist.
- OpenAPI and a `station approve` CLI. Follow-ups, not part of the park contract.

## Where to read next

| Topic | Doc |
| --- | --- |
| How to change behavior | [docs/ENGINEERING.md](ENGINEERING.md) |
| Types a forker implements | [docs/CONTRACT.md](CONTRACT.md) |
| Send, waits, context, ticket verdicts | [docs/designs/kit-contract.md](designs/kit-contract.md) |
| Deploy | [docs/DEPLOY.md](DEPLOY.md) |
| First local run | [docs/FIRST_RUN.md](FIRST_RUN.md) |
| Desk | [docs/DESIGN.md](DESIGN.md) |
| Add a channel | [docs/ADDING_A_CHANNEL.md](ADDING_A_CHANNEL.md) |
| Privacy | [docs/PRIVACY.md](PRIVACY.md) |
| Ticket order | [tickets/README.md](../tickets/README.md) |

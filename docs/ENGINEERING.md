# Engineering law

Code is written to pass tests and evals that already exist. Not the other way around.

If a PR adds behavior without a failing test or eval committed first (or in the same PR *above* the implementation, in a first commit), it is incomplete. Do not merge it to `dev`.

## Ticket order (every T1–Tn)

1. **Write the ticket** in `tickets/T<n>-<slug>/` with `tests.md` and `evals.md` filled in.
2. **Write the tests and evals.** They must fail or skip-with-reason. No implementation yet.
3. **Review the red suite.** If a test cannot fail for a real reason, it is not a test.
4. **Write the minimum program** that turns red into green.
5. **Refactor** only while green. Do not add behavior without a new red test or eval.

Git history on the ticket branch should look like:

```
test(T3): failing sendId and double-Approve cases
eval(T3): recorded send traces
feat(T3): make Approve idempotent
```

Not:

```
feat(T3): idempotent Approve
test(T3): cover the new code
```

## What is a test vs an eval

| Kind | Lives in | Proves | May call a model |
| --- | --- | --- | --- |
| **Test** | `*.test.ts` | Deterministic contract, errors, isolation, HTTP, SQL | No |
| **Eval** | `evals/suites/*.eval.ts` | Agent quality: draft, park vs drop, pack switch | Yes, or recorded traces |

CI merge gate (locked): recorded replay, isolation hook, double-Approve mock, compose smoke. Those are tests. Live-model evals are not a merge gate unless marked `gate: merge`.

Recorded evals (`gate: merge`) use frozen fixtures. Live evals (`gate: nightly`) are optional later.

## Structured errors

Throw only `StationError`. Never throw a string, a bare `Error`, or an unknown.

```ts
StationError {
  code: ErrorCode        // stable machine id, e.g. send.provider_failed
  status: 4xx | 5xx      // HTTP if the worker surfaces it
  message: string        // safe for logs and the cockpit
  retryable: boolean
  details?: object       // no secrets, no raw email bodies
  cause?: unknown
  tenantId?: string
  requestId?: string
  signalId?: string
}
```

Rules:

- Operational failures (`send.provider_failed`, `lease.held`) are `StationError`. Programmer mistakes (invariant broken) are `StationError` with `code` starting `invariant.` and `status` 500.
- Catch at the worker HTTP edge and the cockpit edge. Map to JSON `{ error: { code, message, requestId } }`. Do not leak stacks to clients.
- Never swallow. A catch that does not rethrow, return a Result, or log-and-map is a bug.
- `commitSend` failure stays `parked` and returns `send.provider_failed`.

Error codes live in `packages/observability`. Adding a code requires a test that the client JSON contains that code.

## Structured logging

Use the shared logger (`packages/observability`). JSON lines. One event per line.

Required fields on every line: `level`, `msg`, `time`, `service`, `requestId`.
Add when known: `tenantId`, `signalId`, `decisionId`, `producer`.

Levels:

- `debug` — noisy internals, off in prod
- `info` — state changes (claimed, parked, sent)
- `warn` — retryable failure
- `error` — non-retryable or exhausted retry

Redact always: OAuth tokens, `STATION_MASTER_KEY`, `STATION_CONTROL_TOKEN`, `STATION_COCKPIT_PASSWORD`, `Authorization` headers, raw mail bodies, pack SQL results that look like credentials.

Do not log at `info` on every poll tick. Heartbeats are `debug`.

## Observability in tickets

Every ticket's `tests.md` must include:

- At least one failure path and the `ErrorCode` it must emit
- Logger redaction if the ticket touches secrets or mail bodies

Every ticket's `evals.md` must include:

- One happy trace
- One "must not send / must park" trace
- `gate: merge` or `gate: nightly`

## Commands

```bash
pnpm test          # implemented packages + ticket inventory (must stay green)
pnpm test:tickets  # T1–T7 contracts; red until that ticket's program exists
pnpm eval:recorded # merge-gate evals, no live model; red until those tickets land
pnpm eval:live     # nightly, needs a model key
```

`pnpm test` is the T0 / inventory gate. It must not wait for T1–T7. Those suites live in `tests/tickets/` and `evals/suites/` so later tickets are written to pass already-committed assertions.

`getStation()` in `packages/station` is a stub that throws `invariant.not_implemented`. Ticket tests and evals call that API. Do not implement worker, schema, send, or Graph to make them pass until that ticket's failing suite is on the branch first. Replace one stub method at a time.

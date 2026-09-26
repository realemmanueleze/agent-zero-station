# T32 tests

Proving suite for the kit contract: `tests/tickets/T32-command-api.test.ts`.

1. `migrations/003_kit.sql` creates `outbox`, `waits`, and `records`. Those names are ledger tables.
2. Inbound parks with no provider call, no outbox row, and no wait.
3. Approve sends once, stores a receipt, and opens one reply wait.
4. A second Approve on sent replays that send. `parked_failed` is `send.already_attempted` and does not call the provider again.
5. A reply on the same mailbox and thread resumes the run and does not send.
6. Kill after sent drops the park row, kills the outbox, releases the lease, and a later Approve is `send.killed`.
7. A crash before the receipt is `send.in_flight`. A second Approve does not call the provider again.
8. Context written for one tenant is not returned for another.
9. Boot scan completes a queued row that has a receipt, with no second provider call.
10. Kill while queued drops a late receipt. `POST /park/:id/receipt` stores an optional provider thread id.
11. A second station on the same catalog finishes a receipted send when it listens, with no provider call, and still reads the first station's context. A queued send with no receipt stays in flight.

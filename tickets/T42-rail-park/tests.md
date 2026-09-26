# T42 tests

After T41. The human gate is the existing park slip. Replace `tests/tickets/T42-rail-park.test.ts` skip with this red suite before program code.

1. `human_review` is a parked decision on `GET /park` with actions Approve, Edit, and Kill.
2. Approve resumes the graph, calls the provider once through the outbox, then pauses at `wait_for_reply`. The ledger sentence is "Sent. Watching for a reply."
3. Edit `{ body }` while no outbox row exists replaces the draft and stays in review. The provider is not called.
4. Edit after an outbox row exists is 409.
5. Kill before send leaves the provider uncalled. Public state stays `dropped`. The sentence is "Killed. Nothing was sent."
6. A second Approve while the run is waiting does not call the provider again. T3's 200 replay still holds for a sent outbox.

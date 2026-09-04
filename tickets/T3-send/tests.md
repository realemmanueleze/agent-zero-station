# T3 tests (commit before send impl)

1. Two parallel Approves on one decision: one `sent`, one replay of the same `Receipt`.
2. `commitSend` throws `send.provider_failed`: state stays `parked`, `retryable: true`.
3. Crash after provider accept: row is `sending`; retry uses same `sendId` and does not create a second provider call in the mock.
4. Kill on `parked` → `dropped`. Kill on `sent` → `send.already_sent`.
5. Edit updates body, state stays `parked`, `beforePark` is re-run (discount floor still applies).
6. Mail body is not present on `info` log lines for Approve.

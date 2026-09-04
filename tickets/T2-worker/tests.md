# T2 tests (commit before worker impl)

1. Worker HTTP binds 127.0.0.1 only. A request to the LAN address is not accepted in the bind test.
2. Missing `STATION_CONTROL_TOKEN` → `401` `{ code: auth.control_token }`.
3. Wrong token → `401` same code. No `Authorization` value in logs (redaction test).
4. Claim then score: second worker calling claim on the same signal gets `claim.taken`.
5. Lease heartbeat: holder renews; a dead holder (no heartbeat) loses the mailbox.
6. Two workers starting the same Gmail producer: only one `startProducer` runs.
7. Unhandled throw in a route becomes `invariant.unhandled` with a `requestId`.
8. Health route returns 200 without a token (liveness) and does not list tenants.

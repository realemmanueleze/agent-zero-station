# T32 tests (commit before program)

Blocked on T28–T31 on `dev`. Replace this skip with a red suite on the T32 branch.

1. `GET /park` still returns `id`, `state`, `actions`, `body`. Additive fields ignored by v1 cockpit.
2. Edit `{ body }` stays parked. `{ draft }` is an alias that writes `body`. Invalid JSON is 400, not 500.
3. Two Approves (control token + stub grant) share one `sendId` and one provider call (T3). Sent Approve is 200 replay. Dropped Approve is `send.already_sent` 409.
4. `interpretParkAction` maps `send.already_sent` to already-sent, not `park.failed`.
5. `POST /inbound` fixture: Bearer control token, localhost, opt-in fixture key. Grant cannot call it. Missing token is `auth.control_token` 401.
6. Worker logs omit `Authorization` and inbound bodies.
7. `$12400` in body is not desk chrome. Pack HTML renderer path is gone.
8. Portal mapper goldens: `body→draft`, `from→customer`, `subject→jobLine`. `windowState` is DTO-only.

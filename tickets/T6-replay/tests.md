# T6 tests (commit before replay CLI)

1. `Pack.draft` exists and is pure. Same signal + scores → same body.
2. Recorded replay compares only `{ state, draftBody, tenantId }` with clock frozen to `2026-01-01T00:00:00Z`.
3. Loading demo fixtures twice still one park (upsert).
4. Pack switch from `sales` to `inbox-triage` on the same signal ids changes the latest decision (re-score job or API).
5. Compose smoke script exits 0 when `/park` JSON contains one parked item.

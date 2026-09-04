# T10 tests (commit before the spine)

1. `migrations/001_ledger.sql` creates `signals`, `claims`, `leases`, `decisions`, and `da_` checkpointer tables.
2. `schema.migrate` against `postgres://migrate-fail` still throws `schema.migrate_failed`.
3. `sales` and `inbox-triage` `draft` are pure and different for the same signal.
4. `sales.beforePark` rewrites a 50% discount to 5%.
5. `runScoringTurn` returns parked or dropped and never exposes a `commit_send` tool.

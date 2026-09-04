# T1 tests (commit these before migrations)

1. Migrating twice is idempotent.
2. Inserting two signals with the same `fixtureId` upserts, row count stays 1.
3. Two transactions cannot claim the same `(signalId, packId)`; one wins, one gets `claim.taken`.
4. Lease insert for a live holder fails or returns `lease.held`.
5. Expired lease (heartbeat older than 30s) can be taken by a second worker.
6. `decisions.sendId` is unique. Second insert with the same `sendId` fails.
7. State update `parked → sending` succeeds once; a second worker's `parked → sending` on the same row affects 0 rows.
8. Checkpointer tables live in the same `STATION_DATABASE_URL` and use a `da_` prefix (or equivalent) so they do not collide with ledger tables.
9. Connecting pack SQL to `STATION_DATABASE_URL` is rejected in config tests (`config.pack_db_same_as_station`).
10. Migration failure throws `StationError` `schema.migrate_failed`, not a raw driver error.

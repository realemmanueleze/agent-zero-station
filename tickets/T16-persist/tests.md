# T16 tests (commit before the ledger bind)

1. Two `getStation()` instances with the same `STATION_DATABASE_URL` see the same GET `/connections` after paste.
2. GET `/connections` after that restart still hides secrets and `STATION_MASTER_KEY`.
3. A parked card with `account` is on the second instance's `/park` list.
4. A different catalog URL does not see the first vault.
5. No `STATION_DATABASE_URL` stays instance-local (second `getStation()` does not inherit the paste).
6. DELETE tombstone survives the second instance; Approve is `connections.missing`.
7. Scoring turn still cannot call `commit_send`.

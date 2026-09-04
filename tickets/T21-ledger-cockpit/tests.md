# T21 tests (commit before the ledger views)

1. `activityFromLedger` contains parked decisions and no canned Slack seed.
2. GET `/activity` after fixture load includes a decision id.
3. GET `/brief?q=` hits a subject from the ledger.
4. Activity JSON has no secrets.
5. Scoring turn still cannot call `commit_send`.

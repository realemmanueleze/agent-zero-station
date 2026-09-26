# T29 tests (rebuild)

1. Approve without `state` is not `sent`. Fetch/JSON/`res.ok` failures stay parked and surface `park.failed` or `park.invalid`.
2. PacksDeck initial active comes from `GET /packs`, not hardcoded `sales`.
3. Connection pages use ledger activity (no seed logs). Email and Slack get ParkQueue.
4. Screen states: loading, error, empty, ready with status/alert roles.
5. Theme cycle: system → light → dark → high-contrast.
6. Scoring turn still cannot `commit_send`.

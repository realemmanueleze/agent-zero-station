# T25 tests (commit before boot wiring)

1. `startWorker` on a catalog that already has a live email row parks inbound without a manual `startLiveProducers`.
2. A second boot on the same catalog does not double-start the same producer (`producerStartCount` stays 1 on that station).
3. Boot with no live rows still parks the demo fixture.
4. Scoring turn still cannot call `commit_send`.

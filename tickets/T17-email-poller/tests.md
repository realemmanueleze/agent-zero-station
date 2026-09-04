# T17 tests (commit before the poller)

1. `startLiveProducers` starts each live email connection and parks inbound with that `account`.
2. A second poll tick increments `producerTickCount` (interval, not one-shot).
3. The 26th live mailbox is skipped (`mailProducerCap` 25).
4. A throwing mailbox does not stop the next mailbox from parking.
5. Same producer ref still starts once (`producerStartCount` stays 1).
6. Scoring turn still cannot call `commit_send`.

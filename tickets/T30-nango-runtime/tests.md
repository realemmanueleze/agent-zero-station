# T30 tests (write before the runtime client)

1. Gmail poll uses the Nango proxy (`Authorization`, `Connection-Id`, `Provider-Config-Key`). JSON never contains the secret.
2. Two accounts never share a `connection-id` on poll or send.
3. Failed Nango send is `send.provider_failed`. The connection stays live / the decision stays parked.
4. Scoring turn still cannot call `commit_send`.
5. Drive is not a station channel. That is a deferred feature, not leftover operator setup.
6. Completing a Nango mailbox after `startLiveProducers("boot")` parks inbound for that account without a restart.

# T19 tests (commit before Graph IO)

1. Missing `STATION_GRAPH_*` is `config.graph_required`.
2. Injected fetch poll returns a normalized `EmailPayload`.
3. `sendGraphMail` POSTs `/me/sendMail` and never SMTP DATA.
4. 401 from Graph is `auth.graph`; 429 is retryable `send.provider_failed`.
5. T7 normalize / sendId machine still hold.
6. Scoring turn still cannot call `commit_send`.

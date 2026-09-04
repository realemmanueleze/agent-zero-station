# T27 tests (commit before the live tool runner)

1. `executeLiveTools` runs `read_signal`, `search_ledger`, `query_db`, `vault_search`, and `escalate` or `drop`. Never `commit_send`.
2. `search_ledger` for tenant A drops tenant B hits.
3. `parkProduced` uses `runLiveTurn`: the parked body is the pack draft, not the raw inbound text.
4. Scoring turn still cannot call `commit_send`.

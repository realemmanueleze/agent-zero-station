# T18 tests (commit before the harness)

1. Live tool table is read_signal, search_ledger, draft_reply, query_db, vault_search, escalate, drop. Never `commit_send`.
2. `runLiveTurn` without a model key equals `runScoringTurn` (recorded path).
3. `buildLivePrompt` for tenant A contains none of tenant B's addresses or body.
4. Winner rule: highest `Score.value` picks the label that becomes parked / dropped / escalated.
5. MCP send-shaped tool names stay denied by default policy.
6. Scoring turn still cannot call `commit_send`.

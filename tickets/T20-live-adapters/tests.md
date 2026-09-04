# T20 tests (commit before the adapters)

1. Slack `chat.postMessage` uses injected fetch; token never appears in the returned JSON.
2. `vaultSearch` finds a note under a temp vault and does not write.
3. `queryPackSql` rejects the station catalog and rejects INSERT/UPDATE/DELETE.
4. MCP tool names matching send/mail/post/write stay denied.
5. Scoring turn still cannot call `commit_send`.

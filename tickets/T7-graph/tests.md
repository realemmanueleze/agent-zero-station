# T7 tests (commit before Graph impl)

1. Graph `normalizeSignal` maps Graph message → `EmailPayload` (`from`, `threadId`, `subject`, `text`, `amount?`).
2. Isolation: Graph tenant B body never appears in tenant A prompt buffer.
3. `commitSend` mock: Graph path uses same `sendId` / `sending` machine as Gmail.
4. Graph auth failure → `send.provider_failed` or `auth.graph`, retryable when 429/5xx.
5. Work/O365 account without Graph config fails fast with `config.graph_required`, not a hang on IMAP.

# Adding a channel

1. Implement `commitSend` and, if it receives, a producer that writes a `Signal` to the ledger.
2. Put the adapter in `packages/channels`.
3. Add one fixture line under `fixtures/`.
4. Register the account in `station.config.ts`. Do not add a second worker.

Email (supported live): IMAP + SMTP, or Gmail hosts via `gmailHosts()`. Slack, Obsidian, DB, and MCP ship as fixtures. Live paths for those are experimental.

`commitSend` failure must stay `parked` and throw `send.provider_failed`.

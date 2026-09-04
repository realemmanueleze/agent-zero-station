# Adding a channel

1. Implement `commitSend` and, if it receives, a producer that writes a `Signal` to the ledger.
2. Put the adapter in `packages/channels`.
3. Add one fixture line under `fixtures/`.
4. Register a seed in `station.config.ts` if you want a demo row. Live accounts are added from `/channels` Add source, not only from config. Do not add a second worker.

Email (supported live): Sign in with Google or paste IMAP/SMTP in Add source. Slack Sign in or bot token paste. Obsidian, db, and MCP collect their fields on the same panel. Secrets sit in the ledger `connections` table.

`commitSend` failure must stay `parked` and throw `send.provider_failed`.

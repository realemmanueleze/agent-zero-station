# T15 tests (commit before the vault)

1. AES-256-GCM round-trip with a 32-byte key; AAD swap throws `StationError`.
2. GET `/connections` and cockpit HTML never contain secrets or `STATION_MASTER_KEY`.
3. Two email connections stay isolated by `account` (not by overloading `tenantId`).
4. Approve does not let the model call `commit_send`; failed send stays parked.
5. POST paste-only: Gmail refresh token in the body is `connections.invalid`.
6. Each new error code appears in client JSON.
7. `applyLedgerMigration` applies `002_connections.sql`; `decisions` persist `account` and `kind`.
8. DELETE then Approve is `connections.missing` and stays parked.
9. OAuth 302 `Location` has no Bearer; logs omit `code` / `state` / `searchParams`.
10. Origin not on the allowlist is rejected; second callback with the same state is `auth.oauth_state`.
11. db URL that matches `STATION_DATABASE_URL` is rejected.
12. Paste `/test` never SMTP DATA; seed hide is per `(kind, account)`.
13. `POST /connections/rotate-keys` re-encrypts; GET still hides secrets.
14. Slack OAuth rejects a bad origin; replay is `auth.oauth_state`.
15. Slack / Obsidian / MCP paste; `sh` MCP command is `connections.invalid`.
16. `needs_reauth` on Approve stays parked.
17. Email producer parks with `account` and `to`.

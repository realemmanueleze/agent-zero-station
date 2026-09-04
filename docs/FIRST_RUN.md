# First run

```bash
pnpm i
cp .env.example .env
pnpm dev
```

Open http://127.0.0.1:19173/park. You should see the demo fixture parked with Approve, Edit, and Kill. ⌘K opens the command palette. A / E / K hit the first parked card.

The worker binds 127.0.0.1:19174. The Next.js cockpit proxies Approve so the browser never sees `STATION_CONTROL_TOKEN`. Restyle with CSS tokens. See [THEMING.md](THEMING.md) and [DESIGN.md](DESIGN.md).

## Live mailbox

1. Create your own Google OAuth client. This repo ships no shared client. Redirect `http://127.0.0.1:19173/oauth/google/callback`.
2. Set `STATION_MASTER_KEY` (32 bytes) plus `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in `.env`. Do not put mailbox passwords or refresh tokens in `.env`.
3. Open `/channels/email` and use Add source: Sign in with Google, or paste IMAP/SMTP. Slack, Obsidian, db, and MCP use the same panel. Connecting never sends.
4. Testing-mode Google refresh tokens die in 7 days. Sign in again on the card. Sign in needs one worker (PKCE is in memory). Local origin is `http://127.0.0.1:19173`.
5. Approve still owns send. If SMTP or Gmail is down the card stays parked.

Isolation: tenant A prompts never include tenant B. Each live mailbox is its own `account`.

Set `STATION_DATABASE_URL`. Two workers that share that catalog share the vault and the park list. No catalog means Add source dies when the process exits.

See [DEPLOY.md](DEPLOY.md) for Compose and a cloud VM.

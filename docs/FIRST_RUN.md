# First run

```bash
pnpm i
cp .env.example .env
pnpm dev
```

Open http://127.0.0.1:19173/park. You should see the demo fixture parked with Approve, Edit, and Kill. ⌘K opens the command palette. A / E / K hit the first parked card.

The worker binds 127.0.0.1:19174. The Next.js cockpit proxies Approve so the browser never sees `STATION_CONTROL_TOKEN`. Restyle with CSS tokens. See [THEMING.md](THEMING.md) and [DESIGN.md](DESIGN.md).

## Live mailbox

1. Create your own Google OAuth client or a Gmail app password. This repo ships no shared client.
2. Set `STATION_IMAP_HOST`, `STATION_IMAP_USER`, `STATION_IMAP_PASS` and the SMTP pair in `.env`. Gmail hosts are `imap.gmail.com` / `smtp.gmail.com`.
3. Append a second mailbox in `station.config.ts`. Isolation: tenant A prompts never include tenant B.
4. Restart `pnpm dev`. A new mail parks. Approve sends through SMTP. If SMTP is down the card stays parked.

Slack, Obsidian, DB, and MCP are fixture rows. Live paths for those are experimental.

See [DEPLOY.md](DEPLOY.md) for Compose and a cloud VM.

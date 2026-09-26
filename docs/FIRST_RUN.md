# First run

```bash
pnpm i
cp .env.example .env
pnpm dev
```

Open http://127.0.0.1:19173/ or http://127.0.0.1:19173/park. You should see the demo fixture parked with Approve, Edit, and Kill. Theme cycles system → light → dark → high contrast. ⌘K opens the command palette. A / E / K hit the first parked card. Connecting a live mailbox is optional and never sends.

The worker binds 127.0.0.1:19174. The Next.js cockpit proxies Approve so the browser never sees `STATION_CONTROL_TOKEN`. Localhost park is open. Off-box desk access needs `STATION_COCKPIT_PASSWORD` (login at `/login`). Nango webhooks post to `/api/nango/webhook` without that password; they still need HMAC. Restyle with CSS tokens. See [THEMING.md](THEMING.md) and [DESIGN.md](DESIGN.md).

## Tracks

**Track A (under 5 minutes).** The commands above. Fixture park. No Gmail.

**Track A2 (optional copy-paste client).** Same fixture. Three curls against the worker. Set `STATION_CONTROL_TOKEN` in `.env` first. `POST /inbound` is opt-in and must not create a second fixture park if the poller already did.

```bash
set -a && source .env && set +a
BASE=http://127.0.0.1:19174
AUTH="Authorization: Bearer $STATION_CONTROL_TOKEN"

curl -sS -H "$AUTH" "$BASE/park"
ID=$(curl -sS -H "$AUTH" "$BASE/park" | python3 -c 'import json,sys; print(json.load(sys.stdin)["items"][0]["id"])')
curl -sS -X POST -H "$AUTH" -H "content-type: application/json" "$BASE/park/$ID/approve"
# optional fixture inbound (control plane only; never a phone grant):
# curl -sS -X POST -H "$AUTH" -H "content-type: application/json" \
#   -d '{"fixtureKey":"first-run","text":"hello"}' "$BASE/inbound"
```

`POST /inbound` is not live until T32. Until then, Track A2 is `GET /park` plus Approve. Second Approve must not send twice (T3: 200, same `sendId`).

If a call fails:

| code | status | problem | cause | fix |
| --- | --- | --- | --- | --- |
| `auth.control_token` | 401 | worker rejected the request | missing or wrong Bearer token | set `STATION_CONTROL_TOKEN` and restart `pnpm dev` |
| `send.already_sent` | 409 | Kill on a sent item, or Approve on dropped | already terminal | do not retry send; desk shows already sent |
| `policy.denied` | 403 | dial is `never` for that class | T33 | change the category dial on the desk, not in chat |
| `grant.missing` | 403 | phone is not linked | T39 | link the phone under Accounts |
| `park.window_expired` | 409 | WhatsApp session closed | T39 | reply in WhatsApp, then Approve |
| `pack.unknown` | 400 | pack id is not registered | T33 | do not expect unknown ids to fall back to sales |
| `rail.missing` | 409 | deposit rail not connected | T39/T40 | connect Square or Stripe, stay parked |

**Track B (proving gate).** A real Unseen Engine inbound parks after worker restart. Slack `#inbound` does not wait on Google verification. Gmail does. Testing-mode Google refresh tokens die in 7 days. See [TODOS.md](../TODOS.md).

## Live mailbox

1. Create your own Google OAuth client. This repo ships no shared client. Redirect `http://127.0.0.1:19173/oauth/google/callback`.
2. Set `STATION_MASTER_KEY` (32 bytes) plus `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in `.env`. Do not put mailbox passwords or refresh tokens in `.env`.
3. Open `/channels/email` and use Add source: Sign in with Google, or paste IMAP/SMTP. Slack, Obsidian, db, and MCP use the same panel. Connecting never sends. Optional: set `NANGO_SECRET_KEY` so Sign in opens Nango Connect (Gmail and Slack). Users grant Google or Slack; they do not create a Nango account. Point Nango's webhook at `http://127.0.0.1:19173/api/nango/webhook` (or `https://<host>/api/nango/webhook`) and set `NANGO_WEBHOOK_SECRET` to the Environment Settings signing key (`X-Nango-Hmac-Sha256`). Drive is the same Google app later. Approve still owns send.
4. Testing-mode Google refresh tokens die in 7 days. Sign in again on the card. Sign in needs one worker (PKCE is in memory). Local origin is `http://127.0.0.1:19173`. Google verification can use `https://<host>/privacy`. See [PRIVACY.md](PRIVACY.md).
5. Approve still owns send. If SMTP or Gmail is down the card stays parked.

Isolation: tenant A prompts never include tenant B. Each live mailbox is its own `account`.

Set `STATION_DATABASE_URL`. Two workers that share that catalog share the vault and the park list. No catalog means Add source dies when the process exits.

Live email connections poll on an interval (`STATION_POLL_MS`, default 30s). Cap 25 mailboxes. `pnpm dev` starts those pollers on boot. One dead box does not stop the others.

See [DEPLOY.md](DEPLOY.md) for Compose and a cloud VM.

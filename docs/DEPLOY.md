# Deploy

Same six boxes on every host:

- [ ] image or `pnpm`
- [ ] `/data` writable
- [ ] model API key (skip on fixture-only)
- [ ] ports 19173 / 19174 or `STATION_COCKPIT_PORT` / `STATION_WORKER_PORT`
- [ ] OAuth/IMAP redirect matches this host (skip on fixture-only)
- [ ] open `/park` and see the demo fixture

## Local pnpm

Node 22+. `pnpm i && cp .env.example .env && pnpm dev`. Open http://127.0.0.1:19173/park.

## Local Compose

Docker 24+. `docker compose up`. Volumes `./data:/data`. Same URL.

## Generic Linux VM

Docker, a hostname, TLS (Caddy). DNS A record, ports 80/443, `/data` disk. OAuth redirect `https://<host>/oauth/callback` on your Google app.

## Fly.io / Railway

One service from the Dockerfile. Volume for `/data`. Secrets: `STATION_MASTER_KEY`, `STATION_CONTROL_TOKEN`, `STATION_COCKPIT_PASSWORD`, `GOOGLE_OAUTH_CLIENT_ID` if you use Gmail API.

## Cloud Run

SQLite-on-Cloud-Run is a poor fit. Prefer a VM, Fly, or Railway for stateful `/data`. If you still use Cloud Run, mount a volume and treat restarts as ledger loss unless that volume is durable.

`STATION_DATABASE_URL` is the ledger. `PACK_DATABASE_URL` is optional pack SQL. Never the same catalog.

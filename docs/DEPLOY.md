# Deploy

Same boxes on every host:

- [ ] image or `pnpm`
- [ ] `/data` writable
- [ ] model API key (skip on fixture-only)
- [ ] ports 19173 / 19174 or `STATION_COCKPIT_PORT` / `STATION_WORKER_PORT`
- [ ] `STATION_MASTER_KEY` set (32 bytes)
- [ ] `STATION_COCKPIT_PASSWORD` if the desk is reachable off localhost
- [ ] OAuth redirect `https://<host>/oauth/google/callback` (skip on fixture-only)
- [ ] Nango webhook `https://<host>/api/nango/webhook` plus `NANGO_SECRET_KEY` / `NANGO_WEBHOOK_SECRET` (skip unless using Nango)
- [ ] open `/park` and see the demo fixture

## Local pnpm

Node 22+. `pnpm i && cp .env.example .env && pnpm dev`. Open http://127.0.0.1:19173/park.

## Local Compose

Docker 24+. `docker compose up`. Volumes `./data:/data`. Host map is `127.0.0.1:19173` so the published port stays loopback. Same URL. Fixture-only smoke: `pnpm smoke:compose` (`127.0.0.1:29173`).

## Generic Linux VM

Docker, a hostname, TLS (Caddy). DNS A record, ports 80/443, `/data` disk. Set `STATION_PUBLIC_URL=https://<host>`. Off-box desk needs `STATION_COCKPIT_PASSWORD`. OAuth redirect `https://<host>/oauth/google/callback` on your Google app.

## Fly.io / Railway

`fly.toml` is in the repo. `fly launch` then set secrets and a volume for `/data`. Tagged pushes publish `ghcr.io/<owner>/<repo>:<tag>` via `.github/workflows/release.yml`.

One service from the Dockerfile. Volume for `/data`. Secrets: `STATION_MASTER_KEY`, `STATION_CONTROL_TOKEN`, `STATION_COCKPIT_PASSWORD`, `GOOGLE_OAUTH_CLIENT_ID` if you use Gmail API. Add `NANGO_SECRET_KEY` and `NANGO_WEBHOOK_SECRET` if Add source uses Nango Connect.

## Cloud Run

SQLite-on-Cloud-Run is a poor fit. Prefer a VM, Fly, or Railway for stateful `/data`. If you still use Cloud Run, mount a volume and treat restarts as ledger loss unless that volume is durable.

`STATION_DATABASE_URL` is the ledger and the vault. `PACK_DATABASE_URL` is optional pack SQL. Never the same catalog. Restart the station on the same catalog and Add source plus parked cards are still there.

# Agent Zero Station

An open-source command station you clone, connect to your own mail and tools, restyle, and run in one container. The agent drafts. You approve. Same image on a laptop and in the cloud.

This repo is not [frdel/agent-zero](https://github.com/frdel/agent-zero). That is a general agent runtime. This is an opinionated station kit: the worker drafts, a person approves, and the ledger is the pause-and-resume host. Deep Agents is a later wrap around draft, not a dependency in this tree.

## Branches

- `dev` — default. Staging. Open PRs here.
- `main` — production.

## Design

[docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) — structure, deploy, agents, context, memory, scale, security, and the harness.

[docs/designs/kit-contract.md](docs/designs/kit-contract.md) — approved send, wait, and context contract.

[docs/designs/agent-zero-station-kit.md](docs/designs/agent-zero-station-kit.md)

## How we build

Tests and evals come first. Code is written to pass them. Errors are `StationError`. Logs are JSON through `@station/observability`. See [docs/ENGINEERING.md](docs/ENGINEERING.md), [docs/CONTRACT.md](docs/CONTRACT.md), [docs/ADDING_A_CHANNEL.md](docs/ADDING_A_CHANNEL.md), and [tickets/](tickets/).

```bash
pnpm i
pnpm dev           # cockpit :19173, worker :19174
pnpm test          # contracts + recorded evals
```

Open http://127.0.0.1:19173/ for the action queue. Channels, activity, and brief sit next to it. Localhost is open; off-box desk access needs `STATION_COCKPIT_PASSWORD`. See [docs/FIRST_RUN.md](docs/FIRST_RUN.md).

`docker compose up` publishes the cockpit on `127.0.0.1:19173`. Live Gmail/Slack is Add source (optional Nango Connect) in FIRST_RUN. Cloud install is [docs/DEPLOY.md](docs/DEPLOY.md). MIT licensed.

## Local ports

Cockpit `19173`. Worker `19174` (binds `127.0.0.1` only). Override with `STATION_COCKPIT_PORT` and `STATION_WORKER_PORT`.

# Agent Zero Station

An open-source command station you clone, connect to your own mail and tools, restyle, and run in one container. The agent drafts. You approve. Same image on a laptop and in the cloud.

This repo is not [frdel/agent-zero](https://github.com/frdel/agent-zero). That is a general agent runtime. This is an opinionated station kit on [LangChain Deep Agents](https://github.com/langchain-ai/deepagents).

## Branches

- `dev` — default. Staging. Open PRs here.
- `main` — production.

## Design

[docs/designs/agent-zero-station-kit.md](docs/designs/agent-zero-station-kit.md)

## How we build

Tests and evals come first. Code is written to pass them. Errors are `StationError`. Logs are JSON through `@station/observability`. See [docs/ENGINEERING.md](docs/ENGINEERING.md) and [tickets/](tickets/).

```bash
pnpm i
pnpm dev           # cockpit :19173, worker :19174
pnpm test          # contracts + recorded evals
```

Open http://127.0.0.1:19173/park. See [docs/FIRST_RUN.md](docs/FIRST_RUN.md).

## Local ports

Cockpit `19173`. Worker `19174`. Override with `STATION_COCKPIT_PORT` and `STATION_WORKER_PORT`.

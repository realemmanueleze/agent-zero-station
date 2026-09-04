## Learned User Preferences
- Write tests and evals before program code; code exists to turn those red suites green.
- Never attribute git commits or PRs to Cursor (no `Co-authored-by: Cursor` trailer).
- Cockpit is Next.js: beautiful, themeable, and built from customizable, extendable components.
- Keep a unified action-needed front, plus per-channel detail (email, Slack, and other signal sources) and a workspace brief/query layer.
- This is an open-source kit anyone can clone, extend, and customize; the sales engine is an example pack, not the product.
- After a ticket lands, review and ship to `dev` before starting the next ticket.

## Learned Workspace Facts
- This repo is not [frdel/agent-zero](https://github.com/frdel/agent-zero). The public GitHub is `realemmanueleze/agent-zero-station`. The harness is LangChain Deep Agents (JS), not Vercel Eve.
- pnpm monorepo. Cockpit `:19173`, worker `:19174` (`STATION_COCKPIT_PORT` / `STATION_WORKER_PORT`).
- `dev` is staging (open PRs here). `main` is production.
- Throw only `StationError`. Log JSON only through `@station/observability`. Redact secrets and mail bodies.
- One OCI image: same container locally via Compose and in the cloud.
- Day-one connectors are unlimited email plus Slack, Obsidian, a database, and MCP.
- Worker binds `127.0.0.1` only. Localhost park is open; off-box cockpit access needs a password.
- Ticket order: T0 observability → T1 schema → T2 worker → T3 send → T4 cockpit → T5 config → T6 replay → T7 Graph.

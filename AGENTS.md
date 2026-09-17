## Learned User Preferences
- Write tests and evals before program code; code exists to turn those red suites green.
- Never attribute git commits or PRs to Cursor (no `Co-authored-by: Cursor` trailer).
- Cockpit is Next.js: beautiful, themeable (light/dark from the OS plus high-contrast), and built from customizable, extendable components. Follow this product's command-station direction, not third-party branding.
- Keep a unified action-needed front, plus per-channel detail (email, Slack, and other signal sources) and a workspace brief/query layer.
- This is an open-source kit anyone can clone, extend, and customize; the sales engine is an example pack, not the product.
- After a ticket lands, review and ship to `dev` before starting the next ticket.
- Add sources from the cockpit via Nango/OAuth sign-in or pasted credentials; encrypt stored connector secrets. Other config can stay `.env` for now.
- UI and desk tests must exercise the real Next cockpit with isolated mock backends/providers; handwritten fixture HTML and source-text assertions are not enough.

## Learned Workspace Facts
- This repo is not [frdel/agent-zero](https://github.com/frdel/agent-zero). The public GitHub is `realemmanueleze/agent-zero-station`. The harness is LangChain Deep Agents (JS), not Vercel Eve.
- pnpm monorepo. Cockpit `:19173`, worker `:19174` (`STATION_COCKPIT_PORT` / `STATION_WORKER_PORT`).
- `dev` is staging (open PRs here). `main` is production.
- Throw only `StationError`. Log JSON only through `@station/observability`. Redact secrets and mail bodies.
- One OCI image: same container locally via Compose and in the cloud.
- Day-one connectors are unlimited email plus Slack, Obsidian, a database, and MCP. One `GOOGLE_OAUTH_CLIENT_ID` is the station Google app and can authorize many Gmail accounts; the OAuth callback is on the cockpit, not the worker.
- Nango is the Gmail/Slack connect and runtime layer: browser OAuth, inbound poll/ingest, and operator-approved send. Multiple accounts stay isolated; failed send stays parked; the worker never sends autonomously. Google Drive is deferred, not current supported scope.
- Worker binds `127.0.0.1` only. Localhost park is open; off-box cockpit access needs a password.
- Ticket order: T0 observability → T1 schema → T2 worker → T3 send → T4 cockpit → T5 config → T6 replay → T7 Graph. After T27: land or kill T28–T31 on `dev`, then T32 command API → T33 Deep Agents wrap + dial → T34/T35 episodic → T37 fixture → T36 meter → T37 production → T39/T40. T3 send-once (200 replay, one provider call) must survive T32. Model tools never include `commit_send`.

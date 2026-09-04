# First run

```bash
pnpm i
cp .env.example .env
pnpm dev
```

Open http://127.0.0.1:19173/park. You should see the demo fixture parked with Approve, Edit, and Kill. ⌘K opens the command palette. A / E / K hit the first parked card.

The worker binds 127.0.0.1:19174. The Next.js cockpit proxies Approve so the browser never sees `STATION_CONTROL_TOKEN`. Restyle with CSS tokens. See [THEMING.md](THEMING.md) and [DESIGN.md](DESIGN.md).

Live Gmail, IMAP, and Graph are the next wiring pass. This path is fixture-only.

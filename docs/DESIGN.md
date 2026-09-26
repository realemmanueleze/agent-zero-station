# Cockpit design

Source of truth for `apps/cockpit`. The station is a command desk, not a SaaS marketing site.

## Memorable thing

One screen for everything that needs a human. Approve is the only send.

## Aesthetic

Warm paper in light, charcoal in dark. Copper on anything that needs a human. Quiet until a card parks. Then the card is the only loud object.

Structure follows a command-center pattern: persistent left nav, a copper waiting count on Action, a center queue of parked slips, and a right rail for this turn. That is the desk sold in the Huffman and Call Carmen proposals: four things arrive, each already tagged, waiting items sit in one place, and the operator can Approve, Edit, or Kill from a phone or a laptop. No glance-card dashboard. Spend and sources are ticks beside the waiting count.

## Type

- Intended UI face: IBM Plex Sans. Intended ledger/draft face: IBM Plex Mono. Both SIL OFL; ship files from `apps/cockpit/public/fonts` when bundled.
- Until those files are in the tree, tokens use an honest fallback: Segoe UI / system-ui and ui-monospace. Do not use `local("IBM Plex")` — that only works on machines that already have the font.
- Titles stay small. Density over hero type.

## Color (tokens only)

`--bg` `--bg-spot` `--surface` `--surface-2` `--ink` `--line` `--line-strong` `--mute` `--park-border` `--park-fill` `--ok` `--danger` `--space` `--radius` `--shadow`

Default follows `prefers-color-scheme`. Override with `html[data-theme="light"|"dark"|"high-contrast"]`. Forkers restyle by overriding those variables in `station.theme.css` or `apps/cockpit/themes/*.css`. No TSX edit.

## Layout

Sidebar 15.5rem. Primary nav: Action, Channels, Activity, Brief, Packs. Accounts and Privacy sit under the nav.

- **Action** is the unified desk. Chrome is Assembl plus the install name. A copper waiting count is the only hero number. Sources, spend (`$42 of $100` after T36), and the latest ledger row sit as ticks beside it. Everything that needs a human lands here with Approve / Edit / Kill. Packs may recolor tokens. They may not inject HTML that unhooks those three actions.
- **Channels** is the integrations grid. Each kind (email, Slack, Obsidian, db, MCP) opens isolated connections. More than one email connection opens the same park HITL on that mailbox.
- A connection page shows incoming signals, parked work, and the action log for that source.
- **Activity** is the cross-channel thread of what was received, watched, queried, and decided.
- **Brief** is the “ask the workspace” panel. Query the ledger; get a digest from real rows, not a invented brief.

Action and connection pages stay three columns under the waiting strip: sources/incoming 16rem, work 1fr, loop/log 16rem. Tablet (720–1099) stacks the desk. Mobile (under 720) also stacks the sidebar. Headings carry their own weight; no kicker labels. Park cards are paper slips with a copper border, no fake score meters.

Every desk surface has a named state: loading, error, empty, ready. Errors use `role="alert"`. Empty copy tells the operator what to do next. Slack parks use the same Approve / Edit / Kill queue as email. Activity and Brief never invent seed rows.

## Motion

180ms enter on park cards. No page-wide parallax. Approve removes the card; the inbox row stays and flips state.

## Components

Every visible piece is a named export in `apps/cockpit/src/ui`. One React `ParkCard`. Actions stay Approve / Edit / Kill. A pack theme may recolor; it may not hide those three. T32 deletes the pack HTML renderer path (`registerParkRenderer` + `dangerouslySetInnerHTML`). Money on a slip comes only from `typedAmount`, never a `$` regex on draft text.

The Theme control cycles system → light → dark → high contrast. System follows the operator’s computer.

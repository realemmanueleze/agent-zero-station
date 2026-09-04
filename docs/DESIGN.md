# Cockpit design

Source of truth for `apps/cockpit`. The station is a command deck, not a SaaS marketing site.

## Aesthetic

Charcoal field, warm paper ink, copper on anything that needs a human. Quiet until a card parks. Then the card is the only loud object.

## Type

- UI: IBM Plex Sans
- Ledger, drafts, scores: IBM Plex Mono
- Titles stay small. Density over hero type.

## Color (tokens only)

`--bg` `--ink` `--line` `--mute` `--park-border` `--park-fill` `--ok` `--danger` `--space`

Forkers restyle by overriding those variables in `station.theme.css` or `apps/cockpit/themes/*.css`. No TSX edit.

## Layout

Header 56px. Primary nav: Action, Channels, Activity, Brief, Packs.

- **Action** is the unified queue. Everything that needs a human lands here with Approve / Edit / Kill.
- **Channels** drills into each signal source (email, Slack, Obsidian, db, MCP). More than one email connection opens the same park HITL on that mailbox.
- A connection page shows incoming signals, parked work, and the action log for that source.
- **Activity** is the cross-channel log of what was received, watched, queried, and decided.
- **Brief** queries the workspace and writes a digest from the ledger.

Action and connection pages stay three columns: sources/incoming 16rem, work 1fr, loop/log 16rem. Collapse to one column under 960px.

## Motion

180ms enter on park cards. No page-wide parallax. Approve removes the card; the inbox row stays and flips state.

## Components

Every visible piece is a named export in `apps/cockpit/src/ui`. Packs register card renderers. Actions stay Approve / Edit / Kill. A pack theme may recolor; it may not hide those three.

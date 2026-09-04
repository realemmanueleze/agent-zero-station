# Theming

Load order:

1. `apps/cockpit/tokens.css`
2. `station.theme.css` at the install root, if present (`/station.theme.css`)
3. `packs/<id>/theme.css` when that pack is active (`/packs/<id>/theme.css`)

Override only CSS variables:

`--bg` `--ink` `--line` `--mute` `--park-border` `--park-fill` `--ok` `--danger` `--sans` `--mono`

Pack themes may change accent. They must not hide Approve, Edit, or Kill.

Toggle high contrast from the cockpit command palette (`Toggle theme`) or set `document.documentElement.dataset.theme = "high-contrast"`.

Register a custom parked-card renderer:

```ts
import { registerParkRenderer } from "./src/ui/registry.ts";

registerParkRenderer("sales", (item) => `<article>${item.subject}</article>`);
```

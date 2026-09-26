# Theming

Load order:

1. `apps/cockpit/tokens.css`
2. `station.theme.css` at the install root, if present (`/station.theme.css`)
3. `packs/<id>/theme.css` when that pack is active (`/packs/<id>/theme.css`)

Override only CSS variables:

`--bg` `--bg-spot` `--surface` `--surface-2` `--ink` `--line` `--line-strong` `--mute` `--park-border` `--park-fill` `--ok` `--danger` `--sans` `--mono` `--radius` `--shadow`

Pack themes may change accent. They must not hide Approve, Edit, or Kill. T32 deletes pack HTML card renderers; restyle with tokens only.

Theme follows the operator’s computer (`prefers-color-scheme`) unless they pick Light, Dark, or High contrast. The Theme control and command palette (`Toggle theme`) cycle `system → light → dark → high-contrast`. Persist with `localStorage.station-theme`. Set `document.documentElement.dataset.theme` to override. `prefers-reduced-motion` removes park-card motion. Screen states use `.screen-state.is-loading|is-error|is-empty|is-ready`.

Do not register a custom parked-card HTML renderer. T32 removes `registerParkRenderer`. Recolor `--park-border` / `--park-fill` instead.

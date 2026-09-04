# T22 tests (commit before the cron)

1. `renderProposal` lists sent/killed outcomes and never writes `directives.md`.
2. `writeProposal` creates `packs/<id>/proposals/YYYY-MM-DD.md` only.
3. Empty outcomes still write a fail-closed file (human must apply).
4. Scoring turn still cannot call `commit_send`.

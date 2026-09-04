# T26 tests (commit before the page wiring)

1. Worker activity rows map to `ActivityEvent` without canned Slack seeds.
2. Activity HTML from ledger events has the decision and not `log-slack-1`.
3. Brief uses ledger activity (`seeds: false`) and still hits a northwind query.
4. Scoring turn still cannot call `commit_send`.

# Agent Zero

## Engineering law

Read [docs/ENGINEERING.md](docs/ENGINEERING.md) before writing feature code.

- Tests and evals are written first. Program code exists to turn those red suites green.
- Throw only `StationError`. Log only through `@station/observability`. Redact secrets and mail bodies.
- Ticket order: T0 observability (done as the shared layer) → T1 schema → T2 worker → T3 send → T4 cockpit → T5 config → T6 replay → T7 Graph.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

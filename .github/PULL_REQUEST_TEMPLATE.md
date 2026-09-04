## Ticket

Closes #

## Order (required)

- [ ] First commit on this branch is failing tests and/or recorded evals
- [ ] Feature commits come after those tests exist on the branch
- [ ] `pnpm test` is green
- [ ] `pnpm eval:recorded` is green if this ticket owns a merge-gate eval

## Errors and logs

- [ ] New failure paths throw `StationError` with a stable `code`
- [ ] Logs are JSON via `packages/observability` and redact secrets / mail bodies

## Verify

- Tests added:
- Evals added:
- Manual:

# T16 evals

- `gate: merge` — `evals/suites/persist.restart.eval.ts`: start worker, paste a mailbox, close, start again on the same catalog, GET `/connections` still lists it, secrets absent, model never sends.
- `gate: nightly` — Compose postgres volume, kill the station container, start again, live row still there (not CI).

# T6 evals

- `gate: merge` — `evals/suites/replay.sales-week.eval.ts`: `fixtures/sales-week.jsonl` byte-equal on the compare set.
- `gate: merge` — `evals/suites/replay.pack-switch.eval.ts`: same signals, new pack, park queue label changes.
- `gate: nightly` — live model on the same fixtures; non-gating; log drift.

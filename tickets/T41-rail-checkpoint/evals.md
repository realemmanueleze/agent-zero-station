# T41 evals

- `gate: merge` — `evals/suites/rail.checkpoint.eval.ts`. A fixture inbound pauses with a draft. The provider is not called. Restart keeps the same pause.
- Must not send: the suite's provider count stays 0.

# T4 evals

Cockpit is UI. Merge-gate eval is a playright-free contract test of the park list JSON.

- `gate: merge` — `evals/suites/cockpit.park-list.eval.ts`: fixture park appears with `state: parked` and Approve/Edit/Kill actions present in the payload.
- `gate: nightly` — none until a headed browser job exists

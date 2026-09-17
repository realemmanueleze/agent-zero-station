# T32 evals

- `gate: merge` — `evals/suites/command.api.eval.ts`: fixture GET /park, Approve 200 replay, must-not-send without Approve.
- Happy trace: Track A2 curl Approve.
- Must not send: second Approve does not call the provider.

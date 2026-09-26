# T37 evals

- `gate: merge` — `evals/suites/unseen.inbound.eval.ts`. The trace is a parked consult reply that used the thread, plus Cal.com or a visible gap.
- `gate: nightly` — production inbound after restart. One provider call. The reply resumes the same `runId`.
- Must not send: the fixture cannot send. The workflow scan cannot send.

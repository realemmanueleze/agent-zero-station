# T36 tests

After T35, and before any Huffman traffic. Replace `tests/tickets/T36-observer-runs.test.ts` skip with this red suite first. The observer has no send function.

1. Observer park or escalate leaves `providerCallCount` unchanged.
2. Escalate `{ parkId, reason, actor }` is unique on `(parkId, reason)`.
3. Spend warns at 50 and 80. A frontier model blocks at 100%. An unknown model fails closed.
4. The desk tick is one sentence, `$42 of $100`, copper at 50% or more. The same sentence can show on Slack. No separate meter component.
5. Logs redact secrets and mail bodies.

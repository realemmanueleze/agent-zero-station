# T52 tests

After T51. Swapping the drafter does not change the gate. Replace `tests/tickets/T52-agent-swap.test.ts` skip with this red suite before program code. Absorbs the unknown-pack half of T33.

1. A run drafted by `pack-unseen-engine` and a run drafted by the Deep Agents drafter both pause at `human_review`, send once on Approve, and resume on the same `runId`.
2. An unknown pack id is `pack.unknown` (400). It does not fall through to `sales`.
3. The client park API names stay `GET /park`, Approve, Edit `{ body }`, and Kill. New fields stay additive.

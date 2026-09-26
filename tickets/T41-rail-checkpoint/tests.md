# T41 tests

First PR of the rail train. Replace `tests/tickets/T41-rail-checkpoint.test.ts` skip with this red suite before program code. The run is a LangGraph in a module the worker imports. Do not grow `station.ts` for the graph. The send-once gate stays the ledger outbox. Deep Agents is not imported. Huffman and Carmen are not in this ticket.

1. Starting a run from an inbound email pauses at `human_review` with a draft. The provider is not called.
2. The compiled graph includes `enrich_lead`, `draft_outreach`, `human_review`, `send_email`, and `wait_for_reply`. `enrich_lead` copies the sender and subject onto state. It does not call a CRM.
3. The worker checkpointer writes `da_checkpoints`. A new process with the same thread id is still paused at `human_review`. `MemorySaver` is not the worker checkpointer.
4. `send_email` is not entered before approval. Passing a prior run's state into start does not mint a second `runId`.
5. T3 still returns 200 on a second Approve and still makes one provider call.

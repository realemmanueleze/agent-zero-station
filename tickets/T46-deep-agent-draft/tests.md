# T46 tests

After T45. Deep Agents is the drafter inside three nodes only. Replace `tests/tickets/T46-deep-agent-draft.test.ts` skip with this red suite before program code. This is the ticket that pins `deepagents`.

1. `createDeepAgent` runs only from `draft_outreach`, `draft_response`, and `next_best_actions`.
2. The test boots it on a fake model. No network call.
3. Its tools are `read_signal`, `search_ledger`, `draft_reply`, `query_db`, `vault_search`, `escalate`, and `drop`. `commit_send` is absent.
4. These tools are not registered: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`, `task`.
5. `wrapToolCall` cannot send, cannot call `approveWithConnection`, and cannot let `escalate` send.
6. With no model key, those nodes use `pack-unseen-engine` and the graph still pauses at `human_review`.

# T33 tests

Next build after the kit send path. Replace `tests/tickets/T33-hooks-and-dial.test.ts` skip with this red suite before program code. New behavior lives in a module the worker imports. Do not grow `station.ts` for the dial. T32 send-once stays green: a second Approve is a 200 replay and one provider call. Model tools never include `commit_send`.

1. `LIVE_TOOL_NAMES` stays the seven names. No `commit_send`.
2. `runLiveTurn` without a model key equals `runScoringTurn`.
3. Unknown pack id is `pack.unknown` (400). It does not fall through to `sales`.
4. `pack-unseen-engine` loads. Its draft cannot call transport.
5. Dial: `ask_me` parks, `just_do` holds then re-checks, `never` throws `policy.denied`. A tool and `learning.ts` cannot change the dial.
6. A hold survives restart fail-closed. Kill during a hold cancels it.
7. Deep Agents wraps `draft` only after the first-run eval is green. Until then this suite does not import the library. When it does: `createDeepAgent` boots on a fake model, and `wrapToolCall` cannot send, cannot `approveWithConnection`, and cannot let `escalate` send. Deny `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`, `task`.

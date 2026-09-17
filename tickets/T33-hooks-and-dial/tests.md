# T33 tests (commit before program)

Blocked on T32. Replace this skip with a red suite on the T33 branch.

1. `LIVE_TOOL_NAMES` still the seven names. No `commit_send`.
2. Pin Deep Agents JS. `createDeepAgent` boots against a fake model.
3. wrapToolCall cannot send, cannot `approveWithConnection`, cannot let `escalate` send. Deny `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`, `task`.
4. `runLiveTurn` without a model key equals `runScoringTurn`.
5. Unknown pack id is `pack.unknown` 400, not `salesPack`.
6. `pack-unseen-engine` exists before T37 fixture.
7. Dial: `ask_me` parks, `just_do` holds then re-checks, `never` throws `policy.denied`. Dial cannot be changed by a tool or `learning.ts`.
8. Hold survives restart fail-closed. Kill during hold cancels.

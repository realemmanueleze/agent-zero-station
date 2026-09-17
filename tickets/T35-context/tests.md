# T35 tests (commit before program)

Blocked on T34.

1. Episodic: ledger, inbound, approvals, human edits attach to `recordId`.
2. Few-shot is approved drafts for that record only.
3. Other install / tenant / traveler never appears in the prompt (`must-not-leak`). Uses `buildLivePrompt` filtering.
4. Empty corpus returns empty, not invention.
5. `learning.ts` still does not auto-merge directives. Dial unchanged.

# T35 tests

After T34. Replace `tests/tickets/T35-context.test.ts` skip with this red suite first. The draft reads that tenant’s records in process. Secrets stay out of the prompt.

1. Ledger rows, inbound, approvals, and human edits attach to one `recordId`.
2. Few-shot context is approved drafts for that record only.
3. Another install, tenant, or traveler never appears in `buildLivePrompt`.
4. An empty corpus returns empty. The draft does not invent facts.
5. `learning.ts` does not auto-merge directives. The T33 dial is unchanged.

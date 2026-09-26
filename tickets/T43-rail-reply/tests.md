# T43 tests

After T42. An external event either starts a run or resumes the open one. Replace `tests/tickets/T43-rail-reply.test.ts` skip with this red suite before program code.

1. A reply on `(mailboxId, threadId)` resumes that `runId`. It does not mint a second run.
2. The next draft parks on that run. The provider count for the first send stays 1.
3. A form POST with no open wait starts one run at `enrich_lead`, then pauses at `human_review`. It does not send.
4. The same form POST, when an open reply wait exists for that thread, resumes. It does not start a second run.
5. Mail bodies stay out of logs.

# T38 tests

After T37 production. This is the audit of waits, not the proving metric. Replace `tests/tickets/T38-transcripts-open-work.test.ts` skip with this red suite first.

1. A transcript is received, labeled `lead`, `discovery`, or `delivery`, stored on the record, and parks a next step.
2. An unlabeled transcript is 400 and stays off the lead.
3. Open work takes a vault excerpt plus an email and parks a doc. It does not start a second workflow engine.
4. The parked doc is not sent.

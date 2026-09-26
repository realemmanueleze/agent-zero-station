# T37 tests

The proving gate. After T33–T36. Replace `tests/tickets/T37-unseen-inbound.test.ts` skip with this red suite first. `replay.sales-week` stays as it is. T3 send-once stays green.

`workflow.ts` may list Gmail and park a slip. It is not the graph host. The host remains `outbox` and `waits`. The scan must not call the provider.

The live case waits on three lines that are not invented here: the Unseen mailbox, the thread id, and the sentence a wrong send would create.

1. A fixture inbound on `pack-unseen-engine` loads the whole thread, including messages the mailbox sent. The draft has no invented facts. A Cal.com URL is in the draft, or the gap is visible in the slip.
2. The parked body is that draft. Edit changes the body while no outbox row exists. The thread text is the rationale, not a second card.
3. Nothing is sent until Approve. Approve calls the provider once, stores the receipt and the provider thread id, and opens one reply wait.
4. A reply on that mailbox and thread parks the next draft on the same `runId`.
5. A second Approve on the sent row is a 200 replay and does not call the provider again.
6. Cal.com missing still parks.
7. Slack `#inbound` proving does not wait on Google OAuth. Gmail proving does. The parked slip survives a worker restart.
8. Quote Approve without `typedAmount` stays disabled.

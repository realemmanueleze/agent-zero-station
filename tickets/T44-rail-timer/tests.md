# T44 tests

After T43. Silence is a wait, not a send. Replace `tests/tickets/T44-rail-timer.test.ts` skip with this red suite before program code.

1. An open `timer` wait whose `wake_at` has passed drafts a follow-up and parks it. The provider is not called.
2. A reply on that run marks the open timer `dead`.
3. The proving path does not create a timer row unless a test or a scheduled follow-up inserts one.
4. The worker poll that already scans mail is what wakes the timer. No new broker.

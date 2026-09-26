# T45 tests

After T44. Edges branch on the reply. Replace `tests/tickets/T45-rail-branches.test.ts` skip with this red suite before program code. No CRM client.

1. `triage_reply` sets `goalStage` on the run.
2. A booked reply goes to `process_transcript`, then `next_best_actions`, then `human_review`. The provider is not called.
3. An objection goes to an objection draft, then `human_review`. The provider is not called.
4. Any other reply stays on the reply wait until the next draft is parked.
5. `update_goal_stage` writes the stage onto the run. It does not send.

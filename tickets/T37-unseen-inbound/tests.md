# T37 tests (commit before program)

Blocked on T34/T35. Requires `pack-unseen-engine`. Must not change `replay.sales-week`.

1. Fixture inbound on `pack-unseen-engine` parks a first-response with no invented facts. Cal.com URL in the draft, or the gap is visible.
2. Must-not-send without Approve.
3. Cal.com missing still parks.
4. Production: Slack `#inbound` proving does not wait on Google OAuth. Gmail proving does. Park survives restart (T16).
5. Quote Approve without `typedAmount` is disabled at policy.

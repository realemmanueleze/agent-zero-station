# T34 tests (commit before program)

Blocked on T33.

1. Record `kind` is `lead | traveler | job | client`. Named actor on every write.
2. Fixture webhook upserts an Unseen Engine lead. Isolation by install.
3. No silent DripJobs/HubSpot copy. Thin advisor when vendor has no API.
4. Failure: missing actor is `invariant.unhandled` or a dedicated code, never a silent write.

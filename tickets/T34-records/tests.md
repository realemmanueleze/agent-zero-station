# T34 tests

After T33. Replace `tests/tickets/T34-records.test.ts` skip with this red suite first. Extend `records` in a migration. Keep reads in-process. No context HTTP route and no context screen.

1. A record has `kind` of `lead`, `traveler`, `job`, or `client`, plus a named actor on every write.
2. A missing actor fails. It never writes a silent row.
3. A fixture webhook upserts one Unseen Engine lead. Another install’s tenant does not see that row.
4. The upsert does not Approve and does not call a provider.
5. No copied DripJobs or HubSpot client. A vendor with no API stays a thin advisor.

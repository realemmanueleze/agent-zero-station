# T48 tests

After T47. Context records are the memory store. Replace `tests/tickets/T48-context-records.test.ts` skip with this red suite before program code. Absorbs T34. No context screen and no context HTTP route.

1. A record has `kind` of `lead`, `traveler`, `job`, or `client`, plus a named actor on every write.
2. A missing actor fails. It never writes a silent row.
3. A fixture webhook upserts one lead. Another tenant does not see that row.
4. The upsert does not Approve and does not call a provider.
5. No DripJobs or HubSpot client.

# T50 tests

After T49. A run can point at its LangSmith trace. Replace `tests/tickets/T50-trace-link.test.ts` skip with this red suite before program code. This ticket does not create an organization.

1. With no LangSmith key, the run still parks and `GET /park` has no `traceUrl`.
2. With a key, the run stores a trace id and `GET /park` adds `traceUrl`. A v1 cockpit may ignore the field.
3. The desk shows "View trace" only when `traceUrl` is present. The link opens that run.
4. The trace payload stored on the run is the id and the URL. Mail bodies are not copied into the park list.

# T0 tests (write and watch fail before `packages/observability` impl)

1. `StationError` JSON for clients contains `code`, `message`, `requestId` and never `stack` or `cause`.
2. `StationError` with `code: send.provider_failed` is `retryable: true` and `status: 502`.
3. `StationError` with `code: invariant.missing_tenant` is `retryable: false` and `status: 500`.
4. Logger redacts `STATION_MASTER_KEY`, bearer tokens, and a field named `body` on mail-shaped objects.
5. Logger line always includes `service` and `requestId` when `withContext` was used.
6. `runWithContext` propagates `requestId` to errors thrown inside the callback.
7. Unknown thrown values at the HTTP edge become `invariant.unhandled` and are logged at `error`.

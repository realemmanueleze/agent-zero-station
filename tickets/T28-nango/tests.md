# T28 tests (commit before the Nango client)

1. Missing `NANGO_SECRET_KEY` on session create is `connections.invalid`.
2. Injected session fetch returns `connectLink`. JSON never contains the secret.
3. Completing a Nango connection upserts a live row. Envelope has `connectionId`, not the secret.
4. Import lists Nango connections and upserts each allowed integration.
5. First-party Google start still works when Nango is unset.
6. Scoring turn still cannot call `commit_send`.

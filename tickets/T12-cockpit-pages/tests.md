# T12 tests (commit before /accounts and /packs)

1. `/accounts` HTML lists configured mailbox ids and never contains `STATION_CONTROL_TOKEN`.
2. `/packs` HTML lists `sales` and `inbox-triage`.
3. Activating `inbox-triage` changes the active pack id.
4. Token load order is documented: `tokens.css`, then `station.theme.css`, then pack `theme.css`.

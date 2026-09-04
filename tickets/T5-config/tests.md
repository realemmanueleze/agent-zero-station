# T5 tests (commit before config impl)

1. Same value for `STATION_DATABASE_URL` and `PACK_DATABASE_URL` → `config.pack_db_same_as_station`.
2. Missing `STATION_MASTER_KEY` in non-test env → `config.missing_master_key`.
3. Policy file: default denies MCP tools whose names match `/send|mail|post|write/i`.
4. Policy file can allow a named tool; test both default-deny and explicit-allow.
5. `.env.example` lists every key read by config. A new key without an example fails this test.
6. Secrets in config dumps are redacted.

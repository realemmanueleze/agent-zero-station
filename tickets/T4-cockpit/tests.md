# T4 tests (commit before cockpit impl)

1. Localhost without password: park list 200.
2. Non-localhost without `STATION_COCKPIT_PASSWORD`: 401 `{ code: auth.cockpit_password }`.
3. Approve is POST to the worker via the proxy with the control token; the browser never sees `STATION_CONTROL_TOKEN`.
4. Failed Approve shows `error.code` from the worker, not a stack.
5. Theme tokens file loads; missing `station.theme.css` is not an error.

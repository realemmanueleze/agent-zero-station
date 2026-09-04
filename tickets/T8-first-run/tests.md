# T8 tests (commit these before the runtime)

1. `startStation` serves `/park` on the cockpit port with HTTP 200.
2. The park HTML contains one fixture park plus Approve, Edit, and Kill. It never contains `STATION_CONTROL_TOKEN` or a Bearer token.
3. `GET /park.json` returns `{ items: [...] }` with `state: parked`.
4. Cockpit `POST /park/:id/approve` changes that item to `sent` and the browser HTML still has no control token.
5. Worker listens on 127.0.0.1 only. A request to a LAN host on the worker port is not accepted.
6. Boot loads `fixtures/demo.jsonl`. Loading it twice still yields one parked fixture row.

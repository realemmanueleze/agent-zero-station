# T31 tests (behavioral, not source-text)

Playwright against the real Next cockpit. Isolated mock worker only. No real provider send.

1. Edit / Cancel / Save on the live ParkQueue card.
2. Approve success, Approve failure, Approve double-click (one worker request).
3. Kill marks the row.
4. PacksDeck reloads from mocked `GET /packs` `active`.
5. Network throw and malformed worker JSON stay parked.
6. Keyboard A / E / K on the real queue.
7. Mobile / tablet / desktop: computed StationShell / grid columns, not a width label.
8. Theme cycle on the real Theme control: system, light, dark, high-contrast.

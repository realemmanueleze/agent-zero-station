import { ScreenState } from "./ScreenState.tsx";
import { StationShell } from "./StationShell.tsx";
import { activityFromLedger } from "./workspace.ts";
import type { ActivityEvent, ParkItem } from "./types.ts";

export function renderActivityHtml(events: ActivityEvent[]): string {
  const rows = events
    .map(
      (row) =>
        `<li data-activity="${row.id}"><strong>${row.channel} · ${row.account}</strong><span>${row.action}: ${row.detail}</span></li>`,
    )
    .join("");
  return `<ul class="inbox">${rows}</ul>`;
}

export function ActivityView({
  items,
  events,
  workerUp = true,
}: {
  items: ParkItem[];
  events?: ActivityEvent[];
  workerUp?: boolean;
}) {
  const activity = events ?? activityFromLedger(items);
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Every action taken" waiting={waiting}>
      <main className="work stack">
        <p className="note">Received, watched, queried, and decided. Ledger only. Nothing invented.</p>
        {!workerUp ? (
          <ScreenState status="error" title="Worker is not reachable">
            Activity cannot load from the ledger until the worker is up.
          </ScreenState>
        ) : null}
        {activity.length === 0 ? (
          <ScreenState status="empty" title="No ledger events yet">
            Park a fixture or wait for inbound. This list does not invent rows.
          </ScreenState>
        ) : (
          <ul className="inbox">
            {activity.map((row) => (
              <li key={row.id} data-activity={row.id}>
                <strong>
                  {row.channel} · {row.account}
                </strong>
                <span>
                  {row.action}: {row.detail}
                </span>
                {row.at ? <em>{row.at}</em> : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </StationShell>
  );
}

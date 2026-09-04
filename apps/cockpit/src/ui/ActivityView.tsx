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
}: {
  items: ParkItem[];
  events?: ActivityEvent[];
}) {
  const activity = events ?? activityFromLedger(items);
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Activity: every action taken" waiting={waiting}>
      <main className="work">
        <ul className="inbox">
          {activity.map((row) => (
            <li key={row.id} data-activity={row.id}>
              <strong>
                {row.channel} · {row.account}
              </strong>
              <span>
                {row.action}: {row.detail}
              </span>
              <em>{row.at}</em>
            </li>
          ))}
        </ul>
      </main>
    </StationShell>
  );
}

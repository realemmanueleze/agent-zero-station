import { StationShell } from "./StationShell.tsx";
import { buildActivity } from "./workspace.ts";
import type { ParkItem } from "./types.ts";

export function ActivityView({ items }: { items: ParkItem[] }) {
  const activity = buildActivity(items);
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Activity: every action taken" waiting={waiting}>
      <main className="work">
        <ul className="inbox">
          {activity.map((row) => (
            <li key={row.id}>
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

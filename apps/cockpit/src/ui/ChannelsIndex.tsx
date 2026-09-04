import { StationShell } from "./StationShell.tsx";
import { channelKinds, connectionsFor } from "./workspace.ts";
import type { ParkItem } from "./types.ts";

export function ChannelsIndex({ items }: { items: ParkItem[] }) {
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Channels: every signal source" waiting={waiting}>
      <main className="work">
        <ul className="channel-grid">
          {channelKinds.map((kind) => {
            const rows = connectionsFor(kind);
            return (
              <li key={kind}>
                <a className="channel-card" href={`/channels/${kind}`}>
                  <strong>{kind}</strong>
                  <small>{rows.length === 1 ? "1 connection" : `${rows.length} connections`}</small>
                  <span>{rows.map((row) => row.account).join(" · ") || "none"}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </main>
    </StationShell>
  );
}

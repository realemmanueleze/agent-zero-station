import { StationShell } from "./StationShell.tsx";
import { channelKinds, mergeLiveConnections } from "./workspace.ts";
import type { Connection, ParkItem } from "./types.ts";

export function ChannelsIndex({ items, live = [] }: { items: ParkItem[]; live?: Connection[] }) {
  const waiting = items.filter((item) => item.state === "parked").length;
  const sources = mergeLiveConnections(live);
  return (
    <StationShell title="Channels: every signal source" waiting={waiting}>
      <main className="work">
        <p className="note">Pick a kind, then add as many accounts as you run. Each one is isolated.</p>
        <ul className="source-roster">
          {channelKinds.map((kind) => {
            const rows = sources.filter((row) => row.kind === kind);
            return (
              <li key={kind}>
                <a href={`/channels/${kind}`}>
                  <strong>{kind}</strong>
                  <span>
                    {rows.length === 1 ? "1 connection" : `${rows.length} connections`}
                    {rows.length ? ` · ${rows.map((row) => row.account).join(" · ")}` : ""}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </main>
    </StationShell>
  );
}

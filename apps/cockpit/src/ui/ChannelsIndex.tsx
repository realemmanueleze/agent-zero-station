import { ConnectFlow } from "./ConnectFlow.tsx";
import { waitingCount } from "./park-action.ts";
import { StationShell } from "./StationShell.tsx";
import { channelKinds, mergeLiveConnections, sourceCaption } from "./workspace.ts";
import type { Connection, ParkItem } from "./types.ts";

export function ChannelsIndex({ items, live = [] }: { items: ParkItem[]; live?: Connection[] }) {
  const waiting = waitingCount(items);
  const sources = mergeLiveConnections(live);
  return (
    <StationShell title="Every signal source" waiting={waiting}>
      <main className="work kind-layout">
        <div>
          <p className="note">Add a source, or open a kind. Each account is isolated.</p>
          <ul className="source-roster">
            {channelKinds.map((kind) => {
              const rows = sources.filter((row) => row.kind === kind);
              return (
                <li key={kind}>
                  <a href={`/channels/${kind}`}>
                    <strong>{kind}</strong>
                    <span>
                      {rows.length === 1 ? "1 connection" : `${rows.length} connections`}
                      {rows.length ? ` · ${rows.map((row) => sourceCaption(row)).join(" · ")}` : ""}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
        <ConnectFlow />
      </main>
    </StationShell>
  );
}

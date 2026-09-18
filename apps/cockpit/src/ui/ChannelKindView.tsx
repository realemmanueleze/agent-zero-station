import { AddSourcePanel } from "./AddSourcePanel.tsx";
import { StationShell } from "./StationShell.tsx";
import { itemsForConnection, mergeLiveConnections } from "./workspace.ts";
import type { ChannelKind, Connection, ParkItem } from "./types.ts";

export function ChannelKindView({
  kind,
  items,
  live = [],
}: {
  kind: ChannelKind;
  items: ParkItem[];
  live?: Connection[];
}) {
  const rows = mergeLiveConnections(live).filter((row) => row.kind === kind);
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title={`${kind} connections`} waiting={waiting}>
      <main className="work kind-layout">
        <div>
          <p className="note">
            Each row is its own tenant key. Open one to see incoming signals, parked work, and the log.
          </p>
          <ul className="source-roster">
            {rows.map((row) => {
              const parked = itemsForConnection(items, kind, row.account).filter(
                (item) => item.state === "parked",
              ).length;
              return (
                <li key={row.id}>
                  <a
                    className={row.status === "needs_reauth" ? "needs-reauth" : undefined}
                    href={`/channels/${kind}/${encodeURIComponent(row.id)}`}
                  >
                    <strong>{row.label}</strong>
                    <span>
                      {row.account} · {row.status} · {parked} waiting
                      {row.status === "needs_reauth" ? " · Testing tokens die in 7 days." : ""}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
        <AddSourcePanel kind={kind} />
      </main>
    </StationShell>
  );
}

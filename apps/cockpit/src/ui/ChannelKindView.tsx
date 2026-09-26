import { ConnectFlow } from "./ConnectFlow.tsx";
import { needsYou, waitingCount } from "./park-action.ts";
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
  const waiting = waitingCount(items);
  const title = kind === "email" ? "Email" : `${kind} connections`;
  return (
    <StationShell title={title} waiting={waiting}>
      <main className="work kind-layout">
        <div>
          {kind === "email" && rows.length === 0 ? (
            <p className="note">No mailboxes yet. Sign in with Google or paste IMAP.</p>
          ) : (
            <p className="note">
              Each row is its own tenant key. Open one to see incoming signals, parked work, and the log.
            </p>
          )}
          <ul className="source-roster">
            {rows.map((row) => {
              const parked = itemsForConnection(items, kind, row.account).filter(needsYou).length;
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
        <ConnectFlow kind={kind} />
      </main>
    </StationShell>
  );
}

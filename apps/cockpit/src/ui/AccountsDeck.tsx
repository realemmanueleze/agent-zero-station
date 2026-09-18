"use client";

import { ScreenState } from "./ScreenState.tsx";
import { StationShell } from "./StationShell.tsx";
import type { Connection, Mailbox } from "./types.ts";

export function AccountsDeck({
  mailboxes,
  connections = [],
  workerUp = true,
  waiting = 0,
}: {
  mailboxes: Mailbox[];
  connections?: Connection[];
  workerUp?: boolean;
  waiting?: number;
}) {
  const live = connections.filter((row) => row.kind === "email");
  const empty = live.length === 0 && mailboxes.length === 0;
  return (
    <StationShell title="Mailbox rows" waiting={waiting}>
      <main className="work stack">
        <p className="note">
          Live rows come from the connections vault. Config mailboxes remain as seed labels. Open
          Channels → email to add a source or park on a mailbox.
        </p>
        {!workerUp ? (
          <ScreenState status="error" title="Worker is not reachable">
            Account rows cannot refresh until `pnpm dev` is running.
          </ScreenState>
        ) : null}
        {empty ? (
          <ScreenState status="empty" title="No mailboxes yet">
            Add a source from Channels. Connecting never sends.
          </ScreenState>
        ) : (
          <ul className="source-roster">
            {live.map((row) => (
              <li key={row.id}>
                <a href={`/channels/${row.kind}/${encodeURIComponent(row.id)}`}>
                  <strong>{row.account}</strong>
                  <span>
                    {row.status} · {row.label}
                  </span>
                </a>
              </li>
            ))}
            {mailboxes.map((row) => (
              <li key={`config-${row.id}`}>
                <div>
                  <strong>{row.id}</strong>
                  <span>
                    {row.transport} · {row.credentialsKey}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </StationShell>
  );
}

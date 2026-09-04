"use client";

import { StationShell } from "./StationShell.tsx";
import type { Mailbox } from "./types.ts";

export function AccountsDeck({ mailboxes }: { mailboxes: Mailbox[] }) {
  return (
    <StationShell title="Accounts: mailbox rows">
      <main className="work">
        <ul className="connectors">
          {mailboxes.map((row) => (
            <li key={row.id}>
              <span className="dot live" />
              <div>
                <strong>
                  {row.transport}: {row.id}
                </strong>
                <small>{row.credentialsKey}</small>
              </div>
            </li>
          ))}
        </ul>
        <p className="note">
          Append a row in station.config.ts. No code change. Each mailbox is a tenant key. Open
          Channels → email for the park interface on each connection.
        </p>
      </main>
    </StationShell>
  );
}

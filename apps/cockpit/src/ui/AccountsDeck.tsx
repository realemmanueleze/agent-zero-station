"use client";

import type { Mailbox } from "@station/channels";

export function AccountsDeck({ mailboxes }: { mailboxes: Mailbox[] }) {
  return (
    <div className="deck">
      <header className="top">
        <div>
          <p className="brand-kicker">Station kit</p>
          <h1>Accounts</h1>
        </div>
        <a className="pack" href="/park">
          Back to park
        </a>
      </header>
      <main className="work">
        <ul className="connectors">
          {mailboxes.map((row) => (
            <li key={row.id}>
              <span className="dot live" />
              <div>
                <strong>
                  {row.transport} — {row.id}
                </strong>
                <small>{row.credentialsKey}</small>
              </div>
            </li>
          ))}
        </ul>
        <p className="note">Append a row in station.config.ts. No code change. Each mailbox is a tenant key.</p>
      </main>
    </div>
  );
}

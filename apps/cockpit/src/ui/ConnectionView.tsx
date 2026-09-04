"use client";

import { ParkQueue } from "./ParkQueue.tsx";
import { StationShell } from "./StationShell.tsx";
import { buildActivity, itemsForConnection } from "./workspace.ts";
import type { ChannelKind, Connection, ParkItem } from "./types.ts";

export function ConnectionView({
  kind,
  connection,
  items,
  workerUp = true,
}: {
  kind: ChannelKind;
  connection: Connection;
  items: ParkItem[];
  workerUp?: boolean;
}) {
  const scoped = itemsForConnection(items, kind, connection.account);
  const activity = buildActivity(items).filter(
    (row) => row.channel === kind && row.account === connection.account,
  );
  const waiting = scoped.filter((item) => item.state === "parked").length;
  return (
    <StationShell title={connection.label} waiting={waiting}>
      <main className="grid">
        <aside className="rail">
          <h2>Incoming</h2>
          <ul className="inbox">
            {scoped.length === 0 ? (
              <li>
                <strong>quiet</strong>
                <span>No signals on this connection yet.</span>
              </li>
            ) : (
              scoped.map((item) => (
                <li key={item.id}>
                  <strong>{item.from ?? item.id}</strong>
                  <span>{item.body ?? item.subject}</span>
                  <em>{item.state}</em>
                </li>
              ))
            )}
          </ul>
          <p className="note">This is the same ledger row the pack scored. Nothing hidden.</p>
        </aside>
        {kind === "email" ? (
          <ParkQueue items={scoped} workerUp={workerUp} />
        ) : (
          <section className="work">
            <h2>Actions taken</h2>
            <ul className="inbox">
              {activity.map((row) => (
                <li key={row.id}>
                  <strong>{row.action}</strong>
                  <span>{row.detail}</span>
                  <em>{row.at.slice(11, 16)}</em>
                </li>
              ))}
            </ul>
          </section>
        )}
        <aside className="rail loop">
          <h2>Log</h2>
          <ol>
            {activity.map((row) => (
              <li key={row.id}>
                {row.action} · {row.detail}
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </StationShell>
  );
}

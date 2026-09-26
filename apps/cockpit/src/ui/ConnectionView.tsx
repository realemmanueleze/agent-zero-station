"use client";

import { useEffect } from "react";
import { CONNECT_IDS_KEY } from "./ConnectFlow.tsx";
import { ledgerSentence, sentenceForState, waitingCount } from "./park-action.ts";
import { ParkQueue } from "./ParkQueue.tsx";
import { ScreenState } from "./ScreenState.tsx";
import { StationShell } from "./StationShell.tsx";
import { activityFromLedger, itemsForConnection, kindHasParkQueue } from "./workspace.ts";
import type { ActivityEvent, ChannelKind, Connection, ParkItem } from "./types.ts";

export function ConnectionView({
  kind,
  connection,
  items,
  events,
  workerUp = true,
}: {
  kind: ChannelKind;
  connection: Connection;
  items: ParkItem[];
  events?: ActivityEvent[];
  workerUp?: boolean;
}) {
  const scoped = itemsForConnection(items, kind, connection.account);
  const scopedLedger = activityFromLedger(scoped);
  const fromEvents = (events ?? []).filter((row) => {
    if (row.channel !== kind) {
      return false;
    }
    if (row.account === connection.account) {
      return true;
    }
    return scoped.some((item) => item.id === row.signalId || row.id === `decision-${item.id}`);
  });
  const activity = fromEvents.length > 0 ? fromEvents : scopedLedger;
  const waiting = waitingCount(scoped);
  useEffect(() => {
    sessionStorage.removeItem(CONNECT_IDS_KEY);
  }, []);
  return (
    <StationShell title={connection.label} waiting={waiting}>
      <main className="grid">
        <aside className="rail">
          <h2>Incoming</h2>
          {scoped.length === 0 ? (
            <ScreenState status="empty" title="Quiet on this source">
              No ledger signals yet. Connecting never sends.
            </ScreenState>
          ) : (
            <ul className="inbox">
              {scoped.map((item) => (
                <li key={item.id}>
                  <strong>{item.from ?? item.id}</strong>
                  <span>{item.body ?? item.subject}</span>
                  <em>{ledgerSentence(item, items)}</em>
                </li>
              ))}
            </ul>
          )}
          <p className="note">This is the same ledger row the pack scored. Nothing hidden.</p>
        </aside>
        {kindHasParkQueue(kind) ? (
          <ParkQueue items={scoped} workerUp={workerUp} />
        ) : (
          <section className="work">
            <h2>Actions taken</h2>
            {activity.length === 0 ? (
              <ScreenState status="empty" title="No actions on this source">
                Reads and watches land here when the ledger has them.
              </ScreenState>
            ) : (
              <ul className="inbox">
                {activity.map((row) => (
                  <li key={row.id}>
                    <strong>{sentenceForState(row.action)}</strong>
                    <span>{row.detail}</span>
                    <em>{row.at.slice(11, 16)}</em>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <aside className="rail loop">
          <h2>Log</h2>
          {activity.length === 0 ? (
            <ol>
              <li>No ledger rows yet</li>
            </ol>
          ) : (
            <ol>
              {activity.map((row) => (
                <li key={row.id}>
                  {sentenceForState(row.action)} · {row.detail}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </main>
    </StationShell>
  );
}

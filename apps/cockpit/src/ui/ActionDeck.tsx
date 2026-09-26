"use client";

import { useEffect, useState } from "react";
import { subscribeDesk, type DeskLive } from "./desk-live.ts";
import { turnLoop } from "./loop.ts";
import { ParkQueue } from "./ParkQueue.tsx";
import { ledgerSentence, tickWord, waitingCount } from "./park-action.ts";
import { StationShell } from "./StationShell.tsx";
import { channelKinds, mergeLiveConnections } from "./workspace.ts";
import type { Connection, ParkItem } from "./types.ts";

function liveFrom(items: ParkItem[]): DeskLive {
  const latest = items[0];
  return {
    waiting: waitingCount(items),
    tick: latest ? tickWord(ledgerSentence(latest, items)) : "quiet",
    detail: latest ? (latest.from ?? latest.subject ?? "ledger empty") : "ledger empty",
    steps: turnLoop(items, null),
  };
}

export function ActionDeck({
  items,
  live = [],
  workerUp = true,
}: {
  items: ParkItem[];
  live?: Connection[];
  workerUp?: boolean;
}) {
  const [desk, setDesk] = useState(() => liveFrom(items));
  useEffect(() => subscribeDesk(setDesk), []);
  const sources = mergeLiveConnections(live);
  const sourceCount = sources.length;
  const waiting = desk.waiting;
  return (
    <StationShell title="Everything that needs a human" waiting={waitingCount(items)}>
      <section className="desk-strip" aria-label="desk status">
        <a className="desk-hero" href="#needs-you">
          <strong>{waiting}</strong>
          <span>{waiting === 1 ? "draft waiting for you" : "drafts waiting for you"}</span>
        </a>
        <div className="desk-ticks">
          <a href="/channels">
            <b>{sourceCount}</b> {sourceCount === 1 ? "source" : "sources"}
          </a>
          <a href="/activity">
            <b>{desk.tick}</b> {desk.detail}
          </a>
        </div>
      </section>
      <main className="grid">
        <aside className="rail">
          <h2>Sources</h2>
          <ul className="connectors">
            {channelKinds.map((kind) => {
              const rows = sources.filter((row) => row.kind === kind);
              return (
                <li key={kind}>
                  <span className="dot live" />
                  <div>
                    <strong>
                      <a href={`/channels/${kind}`}>{kind}</a>
                    </strong>
                    <small>{rows.length === 1 ? "1 connection" : `${rows.length} connections`}</small>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="note">A source is a mailbox, Slack workspace, vault, database, or MCP. Open one to see its park list.</p>
        </aside>
        <ParkQueue items={items} workerUp={workerUp} />
        <aside className="rail loop">
          <h2>This turn</h2>
          <ol>
            {desk.steps.map((step) => (
              <li key={step.id} className={step.current ? "current" : undefined}>
                {step.label}
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </StationShell>
  );
}

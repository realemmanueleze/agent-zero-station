"use client";

import { defaultLoop } from "./loop.ts";
import { ParkQueue } from "./ParkQueue.tsx";
import { ScreenState } from "./ScreenState.tsx";
import { StationShell } from "./StationShell.tsx";
import { channelKinds, mergeLiveConnections } from "./workspace.ts";
import type { Connection, ParkItem } from "./types.ts";

export function ActionDeck({
  items,
  live = [],
  workerUp = true,
}: {
  items: ParkItem[];
  live?: Connection[];
  workerUp?: boolean;
}) {
  const waiting = items.filter((item) => item.state === "parked").length;
  const sources = mergeLiveConnections(live);
  const sourceCount = sources.length;
  const latest = items[0];
  return (
    <StationShell title="Action: everything that needs a human" waiting={waiting}>
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
            <b>{latest?.state ?? "quiet"}</b> {latest?.from ?? latest?.subject ?? "ledger empty"}
          </a>
        </div>
      </section>
      {!workerUp ? (
        <ScreenState status="error" title="Worker is not reachable on :19174">
          Start `pnpm dev`. Approve stays local until the worker is up.
        </ScreenState>
      ) : null}
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
            {defaultLoop.map((step) => (
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

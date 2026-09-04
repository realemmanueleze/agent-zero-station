"use client";

import { defaultLoop } from "./loop.ts";
import { ParkQueue } from "./ParkQueue.tsx";
import { StationShell } from "./StationShell.tsx";
import { channelKinds, connectionsFor } from "./workspace.ts";
import type { ParkItem } from "./types.ts";

export function ActionDeck({ items, workerUp = true }: { items: ParkItem[]; workerUp?: boolean }) {
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Action: everything that needs a human" waiting={waiting}>
      <main className="grid">
        <aside className="rail">
          <h2>Sources</h2>
          <ul className="connectors">
            {channelKinds.map((kind) => {
              const rows = connectionsFor(kind);
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
          <p className="note">Open a channel to see each account, its signals, and its log.</p>
        </aside>
        <ParkQueue items={items} workerUp={workerUp} />
        <aside className="rail loop">
          <h2>Loop</h2>
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

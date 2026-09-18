"use client";

import { useMemo, useState } from "react";
import { ScreenState } from "./ScreenState.tsx";
import { StationShell } from "./StationShell.tsx";
import { activityFromLedger, generateBrief, queryWorkspace } from "./workspace.ts";
import type { ActivityEvent, ParkItem } from "./types.ts";

export function BriefView({
  items,
  events,
  initialBrief,
  workerUp = true,
}: {
  items: ParkItem[];
  events?: ActivityEvent[];
  initialBrief?: string;
  workerUp?: boolean;
}) {
  const [query, setQuery] = useState("");
  const activity = useMemo(() => events ?? activityFromLedger(items), [events, items]);
  const matches = queryWorkspace(query, items, activity);
  const brief =
    !query && initialBrief ? initialBrief : generateBrief(items, activity, query);
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Ask the workspace" waiting={waiting}>
      <main className="work stack brief-layout">
        <form
          className="brief-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <input
            aria-label="Query workspace"
            placeholder="Ask the ledger…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        {!workerUp ? (
          <ScreenState status="error" title="Worker is not reachable">
            Brief reads the ledger through the worker. Start `pnpm dev`.
          </ScreenState>
        ) : null}
        <pre className="brief" aria-live="polite">
          {brief || "No brief yet. Query the ledger after a fixture parks."}
        </pre>
        <h2>Hits</h2>
        {matches.items.length === 0 && matches.activity.length === 0 ? (
          <ScreenState status="empty" title="No hits">
            Try another query, or wait for the next parked row.
          </ScreenState>
        ) : (
          <ul className="inbox">
            {matches.items.map((item) => (
              <li key={item.id}>
                <strong>{item.subject ?? item.id}</strong>
                <span>{item.body}</span>
                <em>{item.state}</em>
              </li>
            ))}
            {matches.activity.map((row) => (
              <li key={row.id}>
                <strong>
                  {row.channel} · {row.action}
                </strong>
                <span>{row.detail}</span>
                <em>{row.account}</em>
              </li>
            ))}
          </ul>
        )}
      </main>
    </StationShell>
  );
}

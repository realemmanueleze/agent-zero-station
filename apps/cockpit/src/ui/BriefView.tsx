"use client";

import { useMemo, useState } from "react";
import { StationShell } from "./StationShell.tsx";
import { buildActivity, generateBrief, queryWorkspace } from "./workspace.ts";
import type { ParkItem } from "./types.ts";

export function BriefView({ items }: { items: ParkItem[] }) {
  const [query, setQuery] = useState("");
  const activity = useMemo(() => buildActivity(items), [items]);
  const matches = queryWorkspace(query, items, activity);
  const brief = generateBrief(items, activity, query);
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Brief: ask the workspace" waiting={waiting}>
      <main className="work">
        <form
          className="brief-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <input
            aria-label="Query workspace"
            placeholder="northwind, slack, parked…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <pre className="brief" aria-live="polite">
          {brief}
        </pre>
        <h2>Hits</h2>
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
      </main>
    </StationShell>
  );
}

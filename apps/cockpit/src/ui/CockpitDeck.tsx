"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { commandActions } from "./commands.ts";
import { defaultConnectors } from "./connectors.ts";
import { defaultLoop } from "./loop.ts";
import { ParkSlot } from "./ParkSlot.tsx";
import type { ParkItem } from "./types.ts";

export function CockpitDeck({
  items,
  workerUp = true,
}: {
  items: ParkItem[];
  workerUp?: boolean;
}) {
  const [rows, setRows] = useState(items);
  const [pack, setPack] = useState("sales");
  const [theme, setTheme] = useState("default");
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const parked = rows.filter((row) => row.state === "parked");
  const parkedRef = useRef(parked);
  const paletteRef = useRef(palette);
  parkedRef.current = parked;
  paletteRef.current = palette;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing || paletteRef.current) {
        return;
      }
      const first = parkedRef.current[0];
      const key = event.key.toLowerCase();
      if (key === "a" && first) {
        event.preventDefault();
        void act(first.id, "approve");
      }
      if (key === "e" && first) {
        event.preventDefault();
        beginEdit(first);
      }
      if (key === "k" && first) {
        event.preventDefault();
        void act(first.id, "kill");
      }
      if (key === "p") {
        event.preventDefault();
        togglePack();
      }
      if (key === "t") {
        event.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredCommands = useMemo(
    () =>
      commandActions.filter((action) =>
        action.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  async function act(id: string, action: "approve" | "edit" | "kill", body?: string) {
    const res = await fetch(`/park/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify({ body }) : undefined,
    });
    const json = (await res.json()) as {
      state?: string;
      body?: string;
      error?: { code?: string };
    };
    if (json.error?.code) {
      setNotice(json.error.code);
      return;
    }
    const nextState =
      json.state ?? (action === "approve" ? "sent" : action === "kill" ? "dropped" : "parked");
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, state: nextState, body: json.body ?? body ?? row.body }
          : row,
      ),
    );
    setEditingId(null);
    setNotice(
      action === "approve"
        ? "Sent. Model never called commit_send."
        : action === "edit"
          ? "Draft updated. Still parked."
          : `Marked ${nextState}.`,
    );
  }

  function beginEdit(item: ParkItem) {
    setEditingId(item.id);
    setDraft(item.body ?? "");
  }

  function togglePack() {
    setPack((current) => (current === "sales" ? "inbox-triage" : "sales"));
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "default" ? "high-contrast" : "default";
      document.documentElement.dataset.theme = next;
      return next;
    });
  }

  function runCommand(id: string) {
    const first = parkedRef.current[0];
    if (id === "approve" && first) {
      void act(first.id, "approve");
    }
    if (id === "edit" && first) {
      beginEdit(first);
    }
    if (id === "kill" && first) {
      void act(first.id, "kill");
    }
    if (id === "pack") {
      togglePack();
    }
    if (id === "theme") {
      toggleTheme();
    }
    setPalette(false);
    setQuery("");
  }

  return (
    <div className="deck">
      <header className="top">
        <div>
          <p className="brand-kicker">Station kit</p>
          <h1>Agent Zero</h1>
        </div>
        <nav className="packs" aria-label="packs">
          <button
            type="button"
            className={pack === "sales" ? "pack on" : "pack"}
            onClick={() => setPack("sales")}
          >
            pack: sales
          </button>
          <button
            type="button"
            className={pack === "inbox-triage" ? "pack on" : "pack"}
            onClick={() => setPack("inbox-triage")}
          >
            pack: inbox-triage
          </button>
        </nav>
        <div className="top-actions">
          <button type="button" onClick={() => setPalette(true)}>
            Command ⌘K
          </button>
          <button type="button" onClick={toggleTheme}>
            {theme === "high-contrast" ? "Default theme" : "Theme"}
          </button>
        </div>
      </header>

      <main className="grid">
        <aside className="rail">
          <h2>Connectors</h2>
          <ul className="connectors">
            {defaultConnectors.map((row) => (
              <li key={row.id}>
                <span className={`dot ${row.status}`} />
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </div>
              </li>
            ))}
          </ul>
          <p className="note">No cap on email rows. + account appends. Each row is a tenant key.</p>
        </aside>

        <section className="work">
          <header className="work-head">
            <h2>Parked — human has to say yes</h2>
            <p>{parked.length} waiting</p>
          </header>
          {!workerUp ? (
            <p className="toast warn">Worker is not reachable on :19174. Start `pnpm dev`.</p>
          ) : null}
          {parked.length === 0 ? (
            <div className="empty">
              <p>Nothing parked.</p>
              <p className="note">Load fixtures/demo.jsonl and keep the worker on :19174.</p>
            </div>
          ) : (
            parked.map((item) => (
              <ParkSlot
                key={item.id}
                item={item}
                editing={editingId === item.id}
                draft={draft}
                onApprove={(id) => void act(id, "approve")}
                onEdit={() => beginEdit(item)}
                onChangeDraft={setDraft}
                onSaveEdit={(id) => void act(id, "edit", draft)}
                onCancelEdit={() => setEditingId(null)}
                onKill={(id) => void act(id, "kill")}
              />
            ))
          )}
          <h2>Inbox</h2>
          <ul className="inbox">
            {rows.map((row) => (
              <li key={row.id}>
                <strong>{row.from ?? "fixture"}</strong>
                <span>{row.body ?? row.subject}</span>
                <em>{row.state}</em>
              </li>
            ))}
          </ul>
          {notice ? <p className="toast">{notice}</p> : null}
        </section>

        <aside className="rail loop">
          <h2>Loop</h2>
          <ol>
            {defaultLoop.map((step) => (
              <li key={step.id} className={step.current ? "current" : undefined}>
                {step.label}
              </li>
            ))}
          </ol>
          <p className="note">
            Switch pack and replay. If the park queue never changes, the kit is a lie.
          </p>
        </aside>
      </main>

      {palette ? (
        <div className="palette-scrim" onClick={() => setPalette(false)}>
          <div
            className="palette"
            role="dialog"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              placeholder="Approve, switch pack, toggle theme…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setPalette(false);
                }
                if (event.key === "Enter" && filteredCommands[0]) {
                  runCommand(filteredCommands[0].id);
                }
              }}
            />
            <ul>
              {filteredCommands.map((action) => (
                <li key={action.id}>
                  <button type="button" onClick={() => runCommand(action.id)}>
                    <span>{action.label}</span>
                    <kbd>{action.hint}</kbd>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

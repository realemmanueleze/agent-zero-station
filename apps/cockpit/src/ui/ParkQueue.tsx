"use client";

import { useEffect, useRef } from "react";
import { dispatchCommand, registerCommandHandler } from "./commands.ts";
import { ParkSlot } from "./ParkSlot.tsx";
import { useParkActions } from "./useParkActions.ts";
import type { ParkItem } from "./types.ts";
import { publishWaiting } from "./waiting.ts";

export function ParkQueue({
  items,
  workerUp = true,
}: {
  items: ParkItem[];
  workerUp?: boolean;
}) {
  const { rows, parked, notice, editingId, draft, setDraft, act, beginEdit, setEditingId } =
    useParkActions(items);
  const parkedRef = useRef(parked);
  parkedRef.current = parked;

  useEffect(() => {
    publishWaiting(parked.length);
  }, [parked.length]);

  useEffect(() => {
    const handle = (id: string): boolean => {
      const first = parkedRef.current[0];
      if (!first) {
        return false;
      }
      if (id === "approve") {
        void act(first.id, "approve");
        return true;
      }
      if (id === "edit") {
        beginEdit(first);
        return true;
      }
      if (id === "kill") {
        void act(first.id, "kill");
        return true;
      }
      return false;
    };
    const stop = registerCommandHandler(handle);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "a" || key === "e" || key === "k") {
        event.preventDefault();
        dispatchCommand(key === "a" ? "approve" : key === "e" ? "edit" : "kill");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      window.removeEventListener("keydown", onKey);
    };
  }, [act, beginEdit]);

  return (
    <section className="work">
      <header className="work-head">
        <h2>Needs you</h2>
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
      <h2>Ledger</h2>
      <ul className="inbox">
        {rows.map((row) => (
          <li key={row.id}>
            <strong>{row.from ?? row.accountId ?? "fixture"}</strong>
            <span>{row.body ?? row.subject}</span>
            <em>{row.state}</em>
          </li>
        ))}
      </ul>
      {notice ? <p className="toast">{notice}</p> : null}
    </section>
  );
}

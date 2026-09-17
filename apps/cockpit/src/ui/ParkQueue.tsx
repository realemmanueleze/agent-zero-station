"use client";

import { useEffect, useRef } from "react";
import { dispatchCommand, registerCommandHandler } from "./commands.ts";
import { ParkSlot } from "./ParkSlot.tsx";
import { ScreenState } from "./ScreenState.tsx";
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
  const { rows, parked, notice, editingId, draft, setDraft, act, beginEdit, setEditingId, busyId } =
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
    window.addEventListener("keydown", onKey, true);
    return () => {
      stop();
      window.removeEventListener("keydown", onKey, true);
    };
  }, [act, beginEdit]);

  return (
    <section className="work" id="needs-you" data-hotkeys="on">
      <header className="work-head">
        <h2>Needs you</h2>
        <p className="waiting-count">{parked.length} waiting</p>
      </header>
      {!workerUp ? (
        <ScreenState status="error" title="Worker is not reachable on :19174">
          Start `pnpm dev`. Cards stay parked.
        </ScreenState>
      ) : null}
      {parked.length === 0 ? (
        <ScreenState status="empty" title="Nothing parked">
          The queue is clear. New inbound stays here until you Approve, Edit, or Kill.
        </ScreenState>
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
            busy={busyId === item.id}
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
      {notice ? (
        <ScreenState status={notice.startsWith("park.") || notice.includes("lease") ? "error" : "ready"} title={notice} />
      ) : null}
    </section>
  );
}

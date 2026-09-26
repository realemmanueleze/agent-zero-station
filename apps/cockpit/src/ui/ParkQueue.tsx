"use client";

import { useEffect, useRef } from "react";
import { dispatchCommand, registerCommandHandler } from "./commands.ts";
import { publishDesk } from "./desk-live.ts";
import { turnLoop } from "./loop.ts";
import { ledgerSentence, needsYou, replyOnRun, tickWord } from "./park-action.ts";
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
  const {
    rows,
    notice,
    noticeError,
    editingId,
    draft,
    setDraft,
    act,
    beginEdit,
    setEditingId,
    busyId,
    trackedId,
  } = useParkActions(items);
  const needs = rows.filter(needsYou);
  const needsRef = useRef(needs);
  const busyRef = useRef(busyId);
  const prevIds = useRef<string[]>([]);
  needsRef.current = needs;
  busyRef.current = busyId;

  useEffect(() => {
    publishWaiting(needs.length);
    const latest = rows[0];
    publishDesk({
      waiting: needs.length,
      tick: latest ? tickWord(ledgerSentence(latest, rows)) : "quiet",
      detail: latest ? (latest.from ?? latest.subject ?? "ledger empty") : "ledger empty",
      steps: turnLoop(rows, trackedId),
    });
  }, [needs.length, rows, trackedId]);

  useEffect(() => {
    const ids = needs.map((item) => item.id);
    const prev = prevIds.current;
    const tracked = trackedId;
    if (tracked && prev.includes(tracked) && !ids.includes(tracked)) {
      const index = prev.indexOf(tracked);
      const nextId = ids[index] ?? ids[index - 1];
      if (nextId) {
        document
          .querySelector<HTMLButtonElement>(`[data-decision="${CSS.escape(nextId)}"] [data-action="approve"]`)
          ?.focus();
      } else {
        document.getElementById("nothing-parked")?.focus();
      }
    } else if (busyId) {
      document
        .querySelector<HTMLButtonElement>(`[data-decision="${CSS.escape(busyId)}"] [data-action="approve"]`)
        ?.focus();
    }
    prevIds.current = ids;
  }, [needs, trackedId, busyId]);

  useEffect(() => {
    const handle = (id: string): boolean => {
      const first = needsRef.current[0];
      if (!first) {
        return false;
      }
      const sending = first.state === "sending" || busyRef.current === first.id;
      if (id === "approve") {
        if (busyRef.current === first.id) {
          return true;
        }
        void act(first.id, "approve");
        return true;
      }
      if (id === "edit") {
        if (sending) {
          return true;
        }
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
        <p className="waiting-count">{needs.length} waiting</p>
      </header>
      {!workerUp ? (
        <ScreenState status="error" title="Worker is not reachable on :19174">
          Start `pnpm dev`. Cards stay parked.
        </ScreenState>
      ) : null}
      {needs.length === 0 ? (
        <div id="nothing-parked" tabIndex={-1}>
          <ScreenState status="empty" title="Nothing parked">
            The queue is clear. New inbound stays here until you Approve, Edit, or Kill.
          </ScreenState>
        </div>
      ) : (
        needs.map((item) => (
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
            reply={replyOnRun(item, rows)}
          />
        ))
      )}
      <h2>Ledger</h2>
      <ul className="inbox">
        {rows.map((row) => (
          <li key={row.id}>
            <strong>{row.from ?? row.accountId ?? "fixture"}</strong>
            <span>{row.body ?? row.subject}</span>
            <em>{ledgerSentence(row, rows)}</em>
          </li>
        ))}
      </ul>
      {notice ? <ScreenState status={noticeError ? "error" : "ready"} title={notice} /> : null}
    </section>
  );
}

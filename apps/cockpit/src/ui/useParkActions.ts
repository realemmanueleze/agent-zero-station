"use client";

import { useCallback, useRef, useState } from "react";
import { interpretParkAction, killPhaseFor, type ParkAction } from "./park-action.ts";
import type { ParkItem } from "./types.ts";

export function useParkActions(items: ParkItem[]) {
  const [rows, setRows] = useState(items);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const act = useCallback(async (id: string, action: ParkAction, body?: string) => {
    const prior = rowsRef.current.find((row) => row.id === id);
    const priorState = prior?.state ?? "parked";
    if (action === "approve" && inflight.current.has(id)) {
      return;
    }
    setTrackedId(id);
    if (action === "approve") {
      inflight.current.add(id);
      if (priorState !== "sending") {
        setBusyId(id);
        setRows((current) => current.map((row) => (row.id === id ? { ...row, state: "sending" } : row)));
      }
    }
    try {
      const result = await interpretParkAction(
        fetch(`/park/${encodeURIComponent(id)}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify({ body }) : undefined,
        }),
        action,
        priorState,
      );
      setNotice(result.notice);
      setNoticeError(!result.ok);
      if (!result.ok || !result.state) {
        if (result.state) {
          setRows((current) =>
            current.map((row) => (row.id === id ? { ...row, state: result.state ?? row.state } : row)),
          );
        } else if (action === "approve" && priorState !== "sending") {
          setRows((current) => current.map((row) => (row.id === id ? { ...row, state: priorState } : row)));
        }
        return;
      }
      setRows((current) =>
        current.map((row) => {
          if (row.id !== id) {
            return row;
          }
          const nextState = result.state ?? row.state;
          return {
            ...row,
            state: nextState,
            body: result.body ?? body ?? row.body,
            killPhase: action === "kill" ? killPhaseFor(priorState) : row.killPhase,
          };
        }),
      );
      setEditingId(null);
    } finally {
      if (action === "approve") {
        inflight.current.delete(id);
        setBusyId((current) => (current === id ? null : current));
      }
    }
  }, []);

  const beginEdit = useCallback((item: ParkItem) => {
    const live = rowsRef.current.find((row) => row.id === item.id) ?? item;
    if (live.state === "sending") {
      return;
    }
    setTrackedId(item.id);
    setEditingId(item.id);
    setDraft(live.body ?? "");
  }, []);

  return {
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
  };
}

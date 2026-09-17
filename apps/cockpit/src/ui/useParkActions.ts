"use client";

import { useCallback, useRef, useState } from "react";
import { interpretParkAction, type ParkAction } from "./park-action.ts";
import type { ParkItem } from "./types.ts";

export function useParkActions(items: ParkItem[]) {
  const [rows, setRows] = useState(items);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const parked = rows.filter((row) => row.state === "parked");

  const act = useCallback(async (id: string, action: ParkAction, body?: string) => {
    if (action === "approve") {
      if (inflight.current.has(id)) {
        return;
      }
      inflight.current.add(id);
      setBusyId(id);
    }
    try {
      const result = await interpretParkAction(
        fetch(`/park/${encodeURIComponent(id)}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify({ body }) : undefined,
        }),
        action,
      );
      if (!result.ok || !result.state) {
        setNotice(result.notice);
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, state: result.state ?? row.state, body: result.body ?? body ?? row.body } : row,
        ),
      );
      setEditingId(null);
      setNotice(result.notice);
    } finally {
      if (action === "approve") {
        inflight.current.delete(id);
        setBusyId((current) => (current === id ? null : current));
      }
    }
  }, []);

  const beginEdit = useCallback((item: ParkItem) => {
    setEditingId(item.id);
    setDraft(item.body ?? "");
  }, []);

  return { rows, parked, notice, editingId, draft, setDraft, act, beginEdit, setEditingId, busyId };
}

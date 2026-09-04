"use client";

import { useCallback, useState } from "react";
import type { ParkItem } from "./types.ts";

export function useParkActions(items: ParkItem[]) {
  const [rows, setRows] = useState(items);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const parked = rows.filter((row) => row.state === "parked");

  const act = useCallback(async (id: string, action: "approve" | "edit" | "kill", body?: string) => {
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
        row.id === id ? { ...row, state: nextState, body: json.body ?? body ?? row.body } : row,
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
  }, []);

  const beginEdit = useCallback((item: ParkItem) => {
    setEditingId(item.id);
    setDraft(item.body ?? "");
  }, []);

  return { rows, parked, notice, editingId, draft, setDraft, act, beginEdit, setEditingId };
}

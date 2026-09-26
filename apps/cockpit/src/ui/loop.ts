import { ledgerSentence } from "./park-action.ts";
import type { LoopStep, ParkItem } from "./types.ts";

export const defaultLoop: LoopStep[] = [
  { id: "signal", label: "inbound parked" },
  { id: "candidates", label: "pack scored the ask" },
  { id: "policy", label: "over the floor — held" },
  { id: "hitl", label: "waiting for Approve", current: true },
  { id: "outcome", label: "nothing sends until you do" },
];

const head: LoopStep[] = [
  { id: "signal", label: "inbound parked" },
  { id: "candidates", label: "pack scored the ask" },
  { id: "policy", label: "over the floor — held" },
];

const parkedTail: LoopStep[] = [
  { id: "hitl", label: "waiting for Approve", current: true },
  { id: "outcome", label: "nothing sends until you do" },
];

export function turnLoop(rows: ParkItem[], trackedId: string | null): LoopStep[] {
  if (rows.length === 0) {
    return [...head, ...parkedTail];
  }
  const needs = rows.filter((row) => row.state === "parked" || row.state === "sending");
  const tracked = trackedId ? (rows.find((row) => row.id === trackedId) ?? null) : null;
  const subject = tracked ?? needs[0] ?? null;
  if (!subject) {
    const latest = rows[0];
    if (!latest) {
      return [...head, ...parkedTail];
    }
    return [...head, { id: "hitl", label: ledgerSentence(latest, rows), current: true }];
  }
  if (subject.state === "parked") {
    return [...head, ...parkedTail];
  }
  if (subject.state === "sending") {
    return [...head, { id: "hitl", label: "Sending.", current: true }];
  }
  return [...head, { id: "hitl", label: ledgerSentence(subject, rows), current: true }];
}

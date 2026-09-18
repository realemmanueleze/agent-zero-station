import type { LoopStep } from "./types.ts";

export const defaultLoop: LoopStep[] = [
  { id: "signal", label: "inbound parked" },
  { id: "candidates", label: "pack scored the ask" },
  { id: "policy", label: "over the floor — held" },
  { id: "hitl", label: "waiting for Approve", current: true },
  { id: "outcome", label: "nothing sends until you do" },
];

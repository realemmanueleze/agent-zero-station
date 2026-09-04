import type { LoopStep } from "./types.ts";

export const defaultLoop: LoopStep[] = [
  { id: "signal", label: "signal fixture:demo-1" },
  { id: "candidates", label: "candidates nurture, close, park" },
  { id: "policy", label: "policy deal_size → park" },
  { id: "hitl", label: "HITL interrupt commit_send", current: true },
  { id: "outcome", label: "outcome pending human" },
];

import type { CommandAction } from "./types.ts";

export const commandActions: CommandAction[] = [
  { id: "approve", label: "Approve send", hint: "A", group: "hitl" },
  { id: "edit", label: "Edit draft", hint: "E", group: "hitl" },
  { id: "kill", label: "Kill", hint: "K", group: "hitl" },
  { id: "pack", label: "Switch pack", hint: "P", group: "nav" },
  { id: "theme", label: "Toggle theme", hint: "T", group: "theme" },
];

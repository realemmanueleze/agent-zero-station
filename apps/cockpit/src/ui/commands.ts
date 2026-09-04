import type { CommandAction } from "./types.ts";

type CommandHandler = (id: string) => boolean;
const handlers = new Set<CommandHandler>();

export function registerCommandHandler(handler: CommandHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function dispatchCommand(id: string): boolean {
  for (const handler of handlers) {
    if (handler(id)) {
      return true;
    }
  }
  return false;
}

export const commandActions: CommandAction[] = [
  { id: "approve", label: "Approve send", hint: "A", group: "hitl" },
  { id: "edit", label: "Edit draft", hint: "E", group: "hitl" },
  { id: "kill", label: "Kill", hint: "K", group: "hitl" },
  { id: "pack", label: "Switch pack", hint: "P", group: "nav" },
  { id: "channels", label: "Open channels", hint: "C", group: "nav" },
  { id: "activity", label: "Open activity", hint: "Y", group: "nav" },
  { id: "brief", label: "Open brief", hint: "B", group: "nav" },
  { id: "theme", label: "Toggle theme", hint: "T", group: "theme" },
];

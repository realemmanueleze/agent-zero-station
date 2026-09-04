export type ParkItem = {
  id: string;
  state: string;
  tenantId?: string;
  packId?: string;
  body?: string;
  from?: string;
  subject?: string;
  amount?: number;
  rationale?: string;
};

export type Connector = {
  id: string;
  kind: "email" | "slack" | "obsidian" | "db" | "mcp";
  label: string;
  detail: string;
  status: "isolated" | "watching" | "live" | "added";
};

export type LoopStep = {
  id: string;
  label: string;
  current?: boolean;
};

export type CommandAction = {
  id: string;
  label: string;
  hint: string;
  group: "hitl" | "nav" | "theme";
};

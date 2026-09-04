export type ChannelKind = "email" | "slack" | "obsidian" | "db" | "mcp";

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
  channel?: ChannelKind;
  accountId?: string;
};

export type Connector = {
  id: string;
  kind: ChannelKind;
  label: string;
  detail: string;
  status: "isolated" | "watching" | "live" | "added" | "pending" | "error" | "needs_reauth";
};

export type Connection = Connector & {
  account: string;
};

export type Mailbox = {
  id: string;
  transport: "gmail" | "imap";
  credentialsKey: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  channel: ChannelKind;
  account: string;
  action: string;
  signalId: string;
  detail: string;
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

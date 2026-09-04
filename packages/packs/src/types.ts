export type PackId = "sales" | "inbox-triage";

export type PackSignal = {
  fixtureId?: string;
  text?: string;
  amount?: number;
  from?: string;
  subject?: string;
  tenantId?: string;
};

export type PackScore = {
  name: string;
  value: number;
  label: "defer_draft" | "inaction_drop" | "escalate";
};

export type Pack = {
  id: PackId;
  score(signal: PackSignal): PackScore[];
  draft(signal: PackSignal, scores: PackScore[]): string;
  beforePark(draft: string, signal: PackSignal): "park" | "escalate" | "drop";
};

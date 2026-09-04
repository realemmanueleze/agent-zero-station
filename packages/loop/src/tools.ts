import type { PackScore, PackSignal } from "@station/packs";

export const LIVE_TOOL_NAMES = [
  "read_signal",
  "search_ledger",
  "draft_reply",
  "query_db",
  "vault_search",
  "escalate",
  "drop",
] as const;

export type LiveToolName = (typeof LIVE_TOOL_NAMES)[number];

export function liveToolsIncludeCommitSend(): boolean {
  return (LIVE_TOOL_NAMES as readonly string[]).includes("commit_send");
}

export function isLiveTool(name: string): name is LiveToolName {
  return (LIVE_TOOL_NAMES as readonly string[]).includes(name);
}

export type WinnerLabel = "defer_draft" | "inaction_drop" | "escalate";

export function pickWinner(scores: PackScore[]): WinnerLabel {
  const top = scores.slice().sort((a, b) => b.value - a.value)[0];
  const label = top?.label ?? "defer_draft";
  switch (label) {
    case "defer_draft":
    case "inaction_drop":
    case "escalate":
      return label;
    default: {
      const _never: never = label;
      return _never;
    }
  }
}

export function winnerState(label: WinnerLabel): "parked" | "dropped" | "escalated" {
  switch (label) {
    case "defer_draft":
      return "parked";
    case "inaction_drop":
      return "dropped";
    case "escalate":
      return "escalated";
    default: {
      const _never: never = label;
      return _never;
    }
  }
}

export function buildLivePrompt(input: {
  tenantId: string;
  signal: PackSignal;
  ledgerHits: Array<{ tenantId: string; text: string }>;
}): string {
  const hits = input.ledgerHits.filter((row) => row.tenantId === input.tenantId);
  return [
    `tenant=${input.tenantId}`,
    `from=${input.signal.from ?? ""}`,
    `text=${input.signal.text ?? input.signal.subject ?? ""}`,
    `ledger=${hits.map((row) => row.text).join("\n")}`,
  ].join("\n");
}

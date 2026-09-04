import { StationError } from "@station/observability";
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

export type LiveToolTrace = {
  name: LiveToolName;
  ok: boolean;
  detail: string;
};

export type LiveToolAdapters = {
  ledgerHits?: Array<{ tenantId: string; text: string }>;
  queryDb?: () => { rows: unknown[] };
  vaultSearch?: (needle: string) => string[];
};

export function executeLiveTools(input: {
  signal: PackSignal;
  state: "parked" | "dropped" | "escalated";
  draft: string;
  adapters?: LiveToolAdapters;
}): LiveToolTrace[] {
  const tenant = input.signal.tenantId ?? "";
  const needle = input.signal.text ?? input.signal.subject ?? "";
  const traces: LiveToolTrace[] = [];

  traces.push({ name: "read_signal", ok: true, detail: needle });

  const hits = (input.adapters?.ledgerHits ?? []).filter((row) => row.tenantId === tenant);
  traces.push({
    name: "search_ledger",
    ok: true,
    detail: hits.map((row) => row.text).join("\n"),
  });

  traces.push({ name: "draft_reply", ok: true, detail: input.draft });

  if (input.adapters?.queryDb) {
    try {
      const result = input.adapters.queryDb();
      traces.push({ name: "query_db", ok: true, detail: String(result.rows.length) });
    } catch (err) {
      const code = err instanceof StationError ? err.code : "invariant.unhandled";
      traces.push({ name: "query_db", ok: false, detail: code });
    }
  } else {
    traces.push({ name: "query_db", ok: true, detail: "" });
  }

  if (input.adapters?.vaultSearch) {
    traces.push({
      name: "vault_search",
      ok: true,
      detail: input.adapters.vaultSearch(needle).join("\n"),
    });
  } else {
    traces.push({ name: "vault_search", ok: true, detail: "" });
  }

  switch (input.state) {
    case "escalated":
      traces.push({ name: "escalate", ok: true, detail: "escalated" });
      break;
    case "dropped":
      traces.push({ name: "drop", ok: true, detail: "dropped" });
      break;
    case "parked":
      break;
    default: {
      const _never: never = input.state;
      return _never;
    }
  }

  return traces;
}

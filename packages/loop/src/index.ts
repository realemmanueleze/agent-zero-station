import { getPack, type PackId, type PackSignal } from "@station/packs";

export type ScoringTurn = {
  packId: PackId;
  state: "parked" | "dropped" | "escalated";
  body: string;
  scores: ReturnType<ReturnType<typeof getPack>["score"]>;
  tools: string[];
};

const LIVE_TOOLS = [
  "read_signal",
  "search_ledger",
  "draft_reply",
  "query_db",
  "vault_search",
  "escalate",
  "drop",
];

export function scoringTurnCallsCommitSend(): boolean {
  return LIVE_TOOLS.includes("commit_send");
}

export function runScoringTurn(packId: string, signal: PackSignal): ScoringTurn {
  const pack = getPack(packId);
  const scores = pack.score(signal);
  const drafted = pack.draft(signal, scores);
  const verdict = pack.beforePark(drafted, signal);
  const body =
    pack.id === "sales"
      ? drafted.replace(/50%/gi, "5%").replace(/below floor/gi, "at floor")
      : drafted;
  const state = verdict === "drop" ? "dropped" : verdict === "escalate" ? "escalated" : "parked";
  return {
    packId: pack.id,
    state,
    body,
    scores,
    tools: [...LIVE_TOOLS],
  };
}

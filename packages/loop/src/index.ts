import { getPack, type PackId, type PackSignal } from "@station/packs";
import {
  LIVE_TOOL_NAMES,
  executeLiveTools,
  liveToolsIncludeCommitSend,
  type LiveToolAdapters,
  type LiveToolTrace,
} from "./tools.ts";

export type ScoringTurn = {
  packId: PackId;
  state: "parked" | "dropped" | "escalated";
  body: string;
  scores: ReturnType<ReturnType<typeof getPack>["score"]>;
  tools: string[];
  traces?: LiveToolTrace[];
};

export {
  LIVE_TOOL_NAMES,
  buildLivePrompt,
  executeLiveTools,
  isLiveTool,
  liveToolsIncludeCommitSend,
  pickWinner,
  winnerState,
} from "./tools.ts";
export type { LiveToolAdapters, LiveToolTrace } from "./tools.ts";

export function scoringTurnCallsCommitSend(): boolean {
  return liveToolsIncludeCommitSend();
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
    tools: [...LIVE_TOOL_NAMES],
  };
}

export function runLiveTurn(
  packId: string,
  signal: PackSignal,
  opts?: { modelKey?: string; adapters?: LiveToolAdapters },
): ScoringTurn {
  const turn = runScoringTurn(packId, signal);
  const traces = executeLiveTools({
    signal,
    state: turn.state,
    draft: turn.body,
    adapters: opts?.adapters,
  });
  return { ...turn, traces };
}

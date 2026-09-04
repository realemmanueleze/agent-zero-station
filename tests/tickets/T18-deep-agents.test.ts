import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import {
  LIVE_TOOL_NAMES,
  buildLivePrompt,
  pickWinner,
  runLiveTurn,
  runScoringTurn,
  scoringTurnCallsCommitSend,
  winnerState,
} from "@station/loop";

describe("T18 deep agents", () => {
  it("live tools never include commit_send", () => {
    expect([...LIVE_TOOL_NAMES]).toEqual([
      "read_signal",
      "search_ledger",
      "draft_reply",
      "query_db",
      "vault_search",
      "escalate",
      "drop",
    ]);
    expect(LIVE_TOOL_NAMES).not.toContain("commit_send");
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });

  it("runLiveTurn without a model key equals recorded runScoringTurn", () => {
    const signal = {
      fixtureId: "t18",
      tenantId: "tenant-a",
      from: "lead@acme.com",
      text: "need a quote",
    };
    const recorded = runScoringTurn("sales", signal);
    const live = runLiveTurn("sales", signal);
    expect(live.body).toBe(recorded.body);
    expect(live.state).toBe(recorded.state);
    expect(live.tools).toEqual(recorded.tools);
  });

  it("buildLivePrompt for tenant A drops tenant B hits", () => {
    const prompt = buildLivePrompt({
      tenantId: "tenant-a",
      signal: { fixtureId: "a", tenantId: "tenant-a", text: "hello from A" },
      ledgerHits: [
        { tenantId: "tenant-a", text: "inbox for tenant-a" },
        { tenantId: "tenant-b", text: "tenant-b-secret-body" },
      ],
    });
    expect(prompt).toContain("tenant-a");
    expect(prompt).toContain("hello from A");
    expect(prompt).not.toContain("tenant-b-secret-body");
    expect(prompt).not.toContain("tenant-b@");
  });

  it("winner rule uses the highest score label", () => {
    expect(
      winnerState(
        pickWinner([
          { name: "nurture", value: 0.2, label: "inaction_drop" },
          { name: "close", value: 0.9, label: "defer_draft" },
        ]),
      ),
    ).toBe("parked");
    expect(
      winnerState(
        pickWinner([
          { name: "drop", value: 0.95, label: "inaction_drop" },
          { name: "close", value: 0.1, label: "defer_draft" },
        ]),
      ),
    ).toBe("dropped");
    expect(
      winnerState(
        pickWinner([{ name: "park", value: 0.91, label: "escalate" }]),
      ),
    ).toBe("escalated");
  });

  it("MCP send-shaped tools stay denied", () => {
    const station = getStation({ seed: false });
    expect(station.config.mcpAllowed("mcp_send_mail")).toBe(false);
    expect(station.config.mcpAllowed("query_docs")).toBe(true);
  });
});

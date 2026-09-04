import { describe, expect, it } from "vitest";
import {
  LIVE_TOOL_NAMES,
  buildLivePrompt,
  runLiveTurn,
  scoringTurnCallsCommitSend,
} from "@station/loop";

describe("loop.deep-agents (gate: merge)", () => {
  it("recorded live turn parks; tools omit send; A cannot see B", () => {
    const turn = runLiveTurn("sales", {
      fixtureId: "eval-da",
      tenantId: "tenant-a",
      from: "lead@acme.com",
      text: "Quote for $12400",
    });
    expect(turn.state === "parked" || turn.state === "escalated").toBe(true);
    expect(turn.body.length).toBeGreaterThan(0);
    expect([...LIVE_TOOL_NAMES]).not.toContain("commit_send");
    expect(scoringTurnCallsCommitSend()).toBe(false);
    const prompt = buildLivePrompt({
      tenantId: "tenant-a",
      signal: { fixtureId: "a", tenantId: "tenant-a", text: "alpha" },
      ledgerHits: [
        { tenantId: "tenant-a", text: "alpha-hit" },
        { tenantId: "tenant-b", text: "bravo-secret" },
      ],
    });
    expect(prompt).toContain("alpha-hit");
    expect(prompt).not.toContain("bravo-secret");
  });
});

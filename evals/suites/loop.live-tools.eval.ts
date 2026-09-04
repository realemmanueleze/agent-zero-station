import { describe, expect, it } from "vitest";
import {
  executeLiveTools,
  runLiveTurn,
  scoringTurnCallsCommitSend,
} from "@station/loop";

describe("loop.live-tools (gate: merge)", () => {
  it("inbound draft parks; traces omit send; ledger stays tenant-scoped", () => {
    const turn = runLiveTurn("sales", {
      fixtureId: "eval-t27",
      tenantId: "tenant-a",
      from: "lead@acme.com",
      text: "Quote for $12400",
    });
    expect(turn.state === "parked" || turn.state === "escalated").toBe(true);
    expect(turn.body).toMatch(/sales draft/i);
    const traces = executeLiveTools({
      signal: { fixtureId: "eval-t27", tenantId: "tenant-a", text: "Quote for $12400" },
      state: turn.state,
      draft: turn.body,
      adapters: {
        ledgerHits: [
          { tenantId: "tenant-a", text: "alpha-hit" },
          { tenantId: "tenant-b", text: "bravo-secret" },
        ],
        queryDb: () => ({ rows: [] }),
        vaultSearch: () => [],
      },
    });
    expect(traces.map((row) => row.name)).not.toContain("commit_send");
    expect(traces.find((row) => row.name === "search_ledger")?.detail).toContain("alpha-hit");
    expect(traces.find((row) => row.name === "search_ledger")?.detail).not.toContain("bravo-secret");
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

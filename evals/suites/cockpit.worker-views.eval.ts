import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { mapWorkerActivity } from "../../apps/cockpit/src/lib/worker.ts";
import { activityFromLedger, generateBrief } from "../../apps/cockpit/src/ui/workspace.ts";

describe("cockpit.worker-views (gate: merge)", () => {
  it("mapped activity is ledger-only; brief mentions waiting", () => {
    const events = mapWorkerActivity([
      { id: "decision-demo-1", action: "parked", account: "work@acme.com", detail: "quote", channel: "email" },
    ]);
    expect(events.some((row) => row.id.startsWith("decision-"))).toBe(true);
    expect(events.some((row) => row.id === "log-slack-1")).toBe(false);
    const brief = generateBrief(
      [{ id: "demo-1", state: "parked", subject: "quote", channel: "email" }],
      activityFromLedger([{ id: "demo-1", state: "parked", subject: "quote", channel: "email" }]),
      "",
    );
    expect(brief).toMatch(/waiting/i);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

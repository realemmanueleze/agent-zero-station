import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { mapWorkerActivity } from "../../apps/cockpit/src/lib/worker.ts";
import { renderActivityHtml } from "../../apps/cockpit/src/ui/ActivityView.tsx";
import { activityFromLedger, generateBrief, queryWorkspace } from "../../apps/cockpit/src/ui/workspace.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

const item: ParkItem = {
  id: "demo-1",
  state: "parked",
  subject: "Draft quote · northwind",
  body: "Need a quote for northwind",
  channel: "email",
  accountId: "work@acme.com",
};

describe("T26 cockpit ledger views", () => {
  it("maps worker activity without slack seeds", () => {
    const events = mapWorkerActivity([
      { id: "decision-demo-1", action: "parked", account: "work@acme.com", detail: "Draft quote", channel: "email" },
    ]);
    expect(events[0]?.id).toBe("decision-demo-1");
    expect(events.some((row) => row.id === "log-slack-1")).toBe(false);
  });

  it("activity HTML has the decision and not canned slack", () => {
    const html = renderActivityHtml(activityFromLedger([item]));
    expect(html).toMatch(/decision-demo-1|Draft quote/);
    expect(html).not.toContain("log-slack-1");
  });

  it("brief query hits northwind on ledger activity", () => {
    const activity = activityFromLedger([item]);
    const { items } = queryWorkspace("northwind", [item], activity);
    expect(items.some((row) => row.id === "demo-1")).toBe(true);
    expect(generateBrief([item], activity, "northwind")).toMatch(/northwind|waiting/i);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

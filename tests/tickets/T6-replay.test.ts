import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("T6 replay", () => {
  it("Pack.draft is pure: same signal and scores yield the same body", () => {
    const signal = { fixtureId: "s1", text: "Need a quote" };
    const scores = [{ name: "intent", value: 0.9 }];
    expect(station.replay.draft("sales", signal, scores)).toBe(
      station.replay.draft("sales", signal, scores),
    );
  });

  it("recorded replay compares only state, draftBody, tenantId with a frozen clock", async () => {
    const rows = await station.replay.replayCompare(
      "fixtures/sales-week.jsonl",
      "sales",
    );
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["draftBody", "state", "tenantId"]);
    }
  });

  it("loading demo fixtures twice still yields one park", async () => {
    expect(await station.replay.loadFixturesTwice("fixtures/demo.jsonl")).toBe(1);
  });

  it("pack switch from sales to inbox-triage changes the latest decision", async () => {
    const after = await station.replay.rescore(["sig-1"], "inbox-triage");
    expect(after.packId).toBe("inbox-triage");
  });

  it("compose smoke exits 0 when /park JSON contains one parked item", async () => {
    expect(await station.replay.composeSmokeExit()).toBe(0);
  });
});

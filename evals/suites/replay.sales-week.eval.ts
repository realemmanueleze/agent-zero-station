import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("replay.sales-week (gate: merge)", () => {
  it("fixtures/sales-week.jsonl is byte-equal on the compare set", async () => {
    const first = await station.replay.replayCompare(
      "fixtures/sales-week.jsonl",
      "sales",
    );
    const second = await station.replay.replayCompare(
      "fixtures/sales-week.jsonl",
      "sales",
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    for (const row of first) {
      expect(Object.keys(row).sort()).toEqual(["draftBody", "state", "tenantId"]);
    }
  });
});

import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("worker.claim (gate: merge)", () => {
  it("two workers and one inbound fixture produce one drafted decision", async () => {
    await station.schema.loadFixtureFile("fixtures/demo.jsonl");
    const results = await Promise.allSettled([
      station.worker.claimSignal("demo-1", "sales", "w1"),
      station.worker.claimSignal("demo-1", "sales", "w2"),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(await station.schema.countParked()).toBe(1);
  });
});

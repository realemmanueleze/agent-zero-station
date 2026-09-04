import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("send.park-then-approve (gate: merge)", () => {
  it("recorded fixture, Approve once, mock provider call count is 1", async () => {
    await station.schema.loadFixtureFile("fixtures/demo.jsonl");
    const receipt = await station.send.approve("demo-park");
    expect(await station.send.providerCallCount(receipt.sendId)).toBe(1);
  });
});

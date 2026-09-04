import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("schema.fixture-upsert (gate: merge)", () => {
  it("loading fixtures/demo.jsonl twice yields one parked row", async () => {
    await station.schema.loadFixtureFile("fixtures/demo.jsonl");
    await station.schema.loadFixtureFile("fixtures/demo.jsonl");
    expect(await station.schema.countParked()).toBe(1);
  });
});

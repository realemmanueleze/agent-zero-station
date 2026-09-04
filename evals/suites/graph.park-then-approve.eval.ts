import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("graph.park-then-approve (gate: merge)", () => {
  it("recorded Graph fixture produces one mock send", async () => {
    const result = await station.graph.approveOnce();
    expect(result.providerCalls).toBe(1);
  });
});

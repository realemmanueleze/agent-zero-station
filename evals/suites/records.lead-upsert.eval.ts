import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("records.lead-upsert (gate: merge)", () => {
  it("one lead is stored and nothing is sent", async () => {
    const station = getStation({ seed: false });
    await station.kit.writeContext({
      id: "eval-lead",
      tenantId: "tenant-a",
      body: "Eval lead",
      kind: "lead",
      actor: "eval",
    });
    const rows = await station.kit.readContext("tenant-a");
    expect(rows).toEqual([expect.objectContaining({ id: "eval-lead", kind: "lead" })]);
    expect(await station.send.providerCallCount("send-eval-lead")).toBe(0);
  });
});

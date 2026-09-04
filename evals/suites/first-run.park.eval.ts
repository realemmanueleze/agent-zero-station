import { describe, expect, it } from "vitest";
import { startStation } from "@station/runtime";

describe("first-run.park (gate: merge)", () => {
  it("after boot, /park HTML shows a parked draft and the three HITL actions", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      const html = await (await fetch(`http://127.0.0.1:${runtime.cockpitPort}/park`)).text();
      expect(html).toMatch(/parked/i);
      expect(html).toMatch(/Approve|approve send/i);
      expect(html).toMatch(/Edit|edit draft/i);
      expect(html).toMatch(/Kill|kill/i);
    } finally {
      await runtime.close();
    }
  });
});

import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { scoringTurnCallsCommitSend } from "@station/loop";

describe("cockpit.ledger-views (gate: merge)", () => {
  it("activity and brief come from parked ledger rows", async () => {
    const token = "t21-eval";
    const runtime = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
    });
    try {
      const activity = await fetch(`http://127.0.0.1:${runtime.workerPort}/activity`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await activity.json()) as { items: Array<{ id: string }> };
      expect(json.items.length).toBeGreaterThan(0);
      const brief = await fetch(`http://127.0.0.1:${runtime.workerPort}/brief`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = (await brief.json()) as { brief: string };
      expect(body.brief).toMatch(/waiting/i);
      expect(scoringTurnCallsCommitSend()).toBe(false);
    } finally {
      await runtime.close();
    }
  });
});

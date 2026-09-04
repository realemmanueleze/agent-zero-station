import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import {
  briefForQuery,
  renderActionHomeHtml,
  renderChannelsHtml,
} from "../../apps/cockpit/src/ui/command-deck.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

describe("cockpit.command-deck (gate: merge)", () => {
  it("action home has HITL; channels lists email; brief query hits the fixture", async () => {
    const token = "command-deck-eval-token";
    const runtime = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
    });
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.workerPort}/park`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { items: ParkItem[] };
      const parked = json.items.filter((item) => item.state === "parked");
      expect(parked.length).toBeGreaterThan(0);
      const home = renderActionHomeHtml(json.items);
      expect(home).toMatch(/Approve|approve/i);
      expect(home).toMatch(/Edit|edit/i);
      expect(home).toMatch(/Kill|kill/i);
      expect(home).not.toContain(token);
      expect(renderChannelsHtml()).toMatch(/email/);
      const { matches, brief } = briefForQuery(json.items, "northwind");
      expect(matches.items.some((item) => (item.from ?? "").includes("northwind"))).toBe(true);
      expect(brief).toMatch(/waiting|parked/i);
    } finally {
      await runtime.close();
    }
  });
});

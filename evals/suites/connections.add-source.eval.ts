import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { renderAddSourceHtml, renderEmailChannelHtml } from "../../apps/cockpit/src/ui/command-deck.ts";
import { mergeLiveConnections } from "../../apps/cockpit/src/ui/workspace.ts";
import { scoringTurnCallsCommitSend } from "@station/loop";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

describe("connections.add-source (gate: merge)", () => {
  it("two accounts on Channels HTML, denylist secrets, Approve still parked", async () => {
    const token = "add-source-eval-token";
    const runtime = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_MASTER_KEY: "local-dev-master-key-32-bytes!!!!" },
    });
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.workerPort}/park`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { items: ParkItem[] };
      const parked = json.items.filter((item) => item.state === "parked");
      expect(parked.length).toBeGreaterThan(0);
      const live = mergeLiveConnections([]);
      const html = `${renderEmailChannelHtml()}\n${renderAddSourceHtml("email")}`;
      expect(html).toMatch(/Sign in with Google|Add source/i);
      expect(html).toMatch(/work@acme.com|hello@acme.com/);
      expect(html).not.toContain(token);
      expect(html).not.toContain("STATION_MASTER_KEY");
      expect(html).not.toContain("refreshToken");
      expect(scoringTurnCallsCommitSend()).toBe(false);
      expect(live.some((row) => row.kind === "email")).toBe(true);
    } finally {
      await runtime.close();
    }
  });
});

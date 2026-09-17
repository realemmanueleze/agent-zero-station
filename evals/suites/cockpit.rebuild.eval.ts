import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { renderActionHomeHtml, renderConnectionHtml } from "../../apps/cockpit/src/ui/command-deck.ts";
import { renderScreenStateHtml } from "../../apps/cockpit/src/ui/screen-state.ts";
import { scoringTurnCallsCommitSend } from "@station/loop";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

describe("cockpit.rebuild (gate: merge)", () => {
  it("fixture park stays HITL; slack connection does not invent ledger rows", async () => {
    const token = "rebuild-eval-token";
    const runtime = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
    });
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.workerPort}/park`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { items: ParkItem[] };
      const home = renderActionHomeHtml(json.items);
      expect(home).toMatch(/park-card|Approve/i);
      expect(home).not.toContain(token);
      expect(renderScreenStateHtml("empty", "Nothing parked")).toMatch(/screen-state/);
      const slack = renderConnectionHtml("slack", "acme-hq", [
        {
          id: "slack-1",
          state: "parked",
          channel: "slack",
          accountId: "acme-hq",
          subject: "Quote thread",
        },
      ]);
      expect(slack).toMatch(/Approve|approve/i);
      expect(slack).not.toMatch(/notes\/northwind\.md changed/);
      expect(scoringTurnCallsCommitSend()).toBe(false);
    } finally {
      await runtime.close();
    }
  });
});

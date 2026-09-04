import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { renderParkCardHtml } from "../../apps/cockpit/src/ui/park-card.tsx";

describe("cockpit.next-park (gate: merge)", () => {
  it("rendered park page includes parked state, HITL actions, and no control token", async () => {
    const token = "next-eval-control-token";
    const runtime = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
    });
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.workerPort}/park`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        items: Array<{
          id: string;
          state: string;
          subject?: string;
          body?: string;
        }>;
      };
      const parked = json.items.find((item) => item.state === "parked");
      expect(parked).toBeTruthy();
      const html = renderParkCardHtml({
        id: parked?.id ?? "demo-1",
        state: parked?.state ?? "parked",
        subject: parked?.subject,
        body: parked?.body,
      });
      expect(html).toMatch(/park-card/);
      expect(html).toMatch(/Approve|approve/i);
      expect(html).toMatch(/Edit|edit/i);
      expect(html).toMatch(/Kill|kill/i);
      expect(html).not.toContain("STATION_CONTROL_TOKEN");
      expect(html).not.toContain(token);
      expect(html).not.toContain("Bearer ");
    } finally {
      await runtime.close();
    }
  });
});

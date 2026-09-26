import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("transcripts.open-work (gate: merge)", () => {
  it("a labeled transcript parks and nothing is sent", async () => {
    const station = getStation({ seed: false });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t53-eval" });
    try {
      const posted = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/transcripts",
        method: "POST",
        headers: { authorization: "Bearer t53-eval", "content-type": "application/json" },
        body: JSON.stringify({
          id: "eval-tr",
          tenantId: "tenant-a",
          actor: "eval",
          label: "lead",
          body: "Intro call",
          mailboxId: "box-eval-tr",
          threadId: "thread-eval-tr",
        }),
      });
      expect(posted.status).toBe(200);
      const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
      const slip = (listed.json as { items: Array<{ state: string }> }).items[0];
      expect(slip?.state).toBe("parked");
      expect(await station.send.providerCallCount("send-eval-tr")).toBe(0);
    } finally {
      await bound.close();
    }
  });
});

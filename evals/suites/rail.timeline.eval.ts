import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("rail.timeline (gate: merge)", () => {
  it("after Approve, Activity reads Sent. Watching for a reply.", async () => {
    const station = getStation({ seed: false });
    await station.kit.parkInbound({
      id: "eval-run",
      tenantId: "tenant-a",
      mailboxId: "box-eval-run",
      threadId: "thread-eval-run",
      body: "Hello",
    });
    await station.send.approve("eval-run");
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t51-eval" });
    try {
      const res = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/activity",
        method: "GET",
        headers: { authorization: "Bearer t51-eval" },
      });
      const items = (res.json as { items: Array<{ sentence?: string }> }).items;
      expect(items.some((row) => row.sentence === "Sent. Watching for a reply.")).toBe(true);
    } finally {
      await bound.close();
    }
  });
});

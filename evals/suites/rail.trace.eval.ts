import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("rail.trace (gate: merge)", () => {
  it("no key still parks, and a key adds a trace URL without sending", async () => {
    const plain = getStation({ seed: false });
    plain.config.load({});
    await plain.kit.parkInbound({
      id: "eval-plain",
      tenantId: "tenant-a",
      mailboxId: "box-eval-plain",
      threadId: "thread-eval-plain",
      body: "Hello",
    });
    const plainList = await plain.cockpit.parkList({ host: "127.0.0.1" });
    const plainRow = (
      plainList.json as { items: Array<{ id: string; state: string; traceUrl?: string }> }
    ).items.find((row) => row.id === "eval-plain");
    expect(plainRow?.state).toBe("parked");
    expect(plainRow).not.toHaveProperty("traceUrl");

    const traced = getStation({ seed: false });
    traced.config.load({ LANGSMITH_API_KEY: "ls-eval" });
    await traced.kit.parkInbound({
      id: "eval-traced",
      tenantId: "tenant-a",
      mailboxId: "box-eval-traced",
      threadId: "thread-eval-traced",
      body: "Hello",
    });
    const tracedList = await traced.cockpit.parkList({ host: "127.0.0.1" });
    const tracedRow = (
      tracedList.json as { items: Array<{ id: string; traceUrl?: string }> }
    ).items.find((row) => row.id === "eval-traced");
    expect(tracedRow?.traceUrl).toMatch(/^https:\/\/smith\.langchain\.com\/r\//);
    expect(await traced.send.providerCallCount("send-eval-traced")).toBe(0);
  });
});

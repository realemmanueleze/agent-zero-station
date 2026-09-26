import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { renderParkCardHtml } from "../../apps/cockpit/src/ui/park-card.tsx";

type ParkRow = {
  id: string;
  state: string;
  body?: string;
  traceUrl?: string;
  traceRun?: { id: string; url: string; body?: string };
};

async function listed(station: ReturnType<typeof getStation>, id: string): Promise<ParkRow> {
  const bound = await station.worker.listen({ host: "127.0.0.1", token: "t50" });
  try {
    const res = await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path: "/park",
      method: "GET",
      headers: { authorization: "Bearer t50" },
    });
    const json = res.json as { items: ParkRow[] };
    const row = json.items.find((item) => item.id === id);
    expect(row).toBeTruthy();
    return row as ParkRow;
  } finally {
    await bound.close();
  }
}

describe("T50 trace link", () => {
  it("with no LangSmith key the run parks and GET /park has no traceUrl", async () => {
    const station = getStation({ seed: false });
    station.config.load({});
    await station.kit.parkInbound({
      id: "dec-plain",
      tenantId: "tenant-a",
      mailboxId: "box-plain",
      threadId: "thread-plain",
      body: "Hello",
    });
    const row = await listed(station, "dec-plain");
    expect(row.state).toBe("parked");
    expect(row).not.toHaveProperty("traceUrl");
    expect(await station.send.providerCallCount("send-dec-plain")).toBe(0);
  });

  it("with a key GET /park adds traceUrl and the trace holds no mail body", async () => {
    const station = getStation({ seed: false });
    station.config.load({ LANGSMITH_API_KEY: "ls-test-key" });
    await station.kit.parkInbound({
      id: "dec-traced",
      tenantId: "tenant-a",
      mailboxId: "box-traced",
      threadId: "thread-traced",
      body: "SECRET-MAIL-BODY",
    });
    const row = await listed(station, "dec-traced");
    expect(row.traceUrl).toMatch(/^https:\/\/smith\.langchain\.com\/r\//);
    expect(row.traceRun).toEqual({ id: expect.any(String), url: row.traceUrl });
    expect(JSON.stringify(row.traceRun)).not.toContain("SECRET-MAIL-BODY");
    expect(JSON.stringify(row.traceRun)).not.toContain("ls-test-key");
    expect(await station.send.providerCallCount("send-dec-traced")).toBe(0);
  });

  it("the desk shows View trace only when traceUrl is present", () => {
    const plain = renderParkCardHtml({ id: "dec-plain", state: "parked", body: "Hello" });
    expect(plain).not.toContain("View trace");
    const linked = renderParkCardHtml({
      id: "dec-traced",
      state: "parked",
      body: "Hello",
      traceUrl: "https://smith.langchain.com/r/run-1",
    });
    expect(linked).toContain('href="https://smith.langchain.com/r/run-1"');
    expect(linked).toContain("View trace");
  });
});

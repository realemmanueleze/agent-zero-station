import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("T7 Microsoft Graph", () => {
  it("normalizeSignal maps a Graph message to EmailPayload", () => {
    const payload = station.graph.normalizeSignal({
      from: { emailAddress: { address: "buyer@example.com" } },
      conversationId: "thread-1",
      subject: "Quote",
      body: { content: "Need 12 seats for $12400" },
    });
    expect(payload.from).toBe("buyer@example.com");
    expect(payload.threadId).toBe("thread-1");
    expect(payload.subject).toBe("Quote");
    expect(payload.text).toMatch(/12 seats/);
  });

  it("tenant B body never appears in tenant A prompt buffer", async () => {
    const buffer = await station.graph.promptBuffer("tenant-a");
    expect(buffer).not.toMatch(/tenant-b-secret-body/i);
  });

  it("Graph commitSend uses the same sendId / sending machine as Gmail", async () => {
    const receipt = await station.graph.commitSend({ sendId: "send-graph-1" });
    expect(receipt.sendId).toBe("send-graph-1");
  });

  it("Graph auth failure is send.provider_failed or auth.graph; 429/5xx are retryable", async () => {
    await expect(station.graph.sendFromAuthFailure(502)).rejects.toMatchObject({
      retryable: true,
    });
    await expect(station.graph.sendFromAuthFailure(401)).rejects.toMatchObject({
      code: expect.stringMatching(/^(send\.provider_failed|auth\.graph)$/),
    });
  });

  it("O365 without Graph config fails fast with config.graph_required", async () => {
    await expect(station.graph.startWithoutGraphConfig()).rejects.toMatchObject({
      code: "config.graph_required",
    });
  });
});

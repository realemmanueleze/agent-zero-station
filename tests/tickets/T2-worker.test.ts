import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("T2 worker", () => {
  it("HTTP binds 127.0.0.1 only; LAN host is not accepted", async () => {
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t" });
    const lan = await station.worker.request({
      host: "10.0.0.5",
      port: bound.port,
      path: "/health",
    });
    expect(lan.status).toBeGreaterThanOrEqual(400);
    await bound.close();
  });

  it("missing STATION_CONTROL_TOKEN is 401 auth.control_token", async () => {
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "secret" });
    const res = await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path: "/park",
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: { code: "auth.control_token" } });
    await bound.close();
  });

  it("wrong token is 401 and Authorization never appears in logs", async () => {
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "secret" });
    const res = await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path: "/park",
      headers: { authorization: "Bearer wrong-token-value" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: { code: "auth.control_token" } });
    expect(res.logs.join("\n")).not.toContain("wrong-token-value");
    await bound.close();
  });

  it("second worker claim on the same signal is claim.taken", async () => {
    await station.worker.claimSignal("sig-1", "sales", "w1");
    await expect(station.worker.claimSignal("sig-1", "sales", "w2")).rejects.toMatchObject({
      code: "claim.taken",
    });
  });

  it("dead holder without heartbeat loses the mailbox lease", async () => {
    await station.schema.acquireLease("gmail:acct-1", "w1");
    await station.schema.expireLease("gmail:acct-1");
    await expect(station.schema.acquireLease("gmail:acct-1", "w2")).resolves.toBeUndefined();
  });

  it("two workers starting the same Gmail producer: only one startProducer runs", async () => {
    await Promise.allSettled([
      station.worker.startProducer("gmail:acct-1", "w1"),
      station.worker.startProducer("gmail:acct-1", "w2"),
    ]);
    expect(await station.worker.producerStartCount("gmail:acct-1")).toBe(1);
  });

  it("unhandled throw in a route is invariant.unhandled with a requestId", async () => {
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t" });
    const res = await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path: "/__boom",
      headers: { authorization: "Bearer t" },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({
      error: { code: "invariant.unhandled" },
    });
    expect((res.json as { error: { requestId: string } }).error.requestId).toBeTruthy();
    await bound.close();
  });

  it("health is 200 without a token and does not list tenants", async () => {
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t" });
    const res = await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path: "/health",
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.json)).not.toMatch(/tenant/i);
    await bound.close();
  });
});

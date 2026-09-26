import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

function inbound(id: string, threadId = `thread-${id}`) {
  return {
    id,
    tenantId: "tenant-a",
    mailboxId: "box-a",
    threadId,
    body: `draft ${id}`,
    producerRef: `email:${id}`,
  };
}

describe("T32 kit contract", () => {
  it("migration adds outbox, waits, and records", async () => {
    const sql = readFileSync(join(process.cwd(), "migrations/003_kit.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS outbox/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS waits/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS records/);
    const station = getStation();
    const names = await station.schema.ledgerTableNames();
    expect(names).toEqual(expect.arrayContaining(["outbox", "waits", "records"]));
  });

  it("1. a fixture inbound parks and does not call the provider", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-park"));
    expect(parked.runId).toBeTruthy();
    expect(await station.send.decisionState("dec-park")).toBe("parked");
    expect(await station.kit.outbox("dec-park")).toBeNull();
    expect(await station.kit.waits(parked.runId)).toEqual([]);
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
  });

  it("2. Approve sends once and leaves sent with one open reply wait", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-send"));
    const receipt = await station.send.approve("dec-send");
    expect(receipt.sendId).toBe(parked.sendId);
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    expect(await station.send.decisionState("dec-send")).toBe("sent");
    const outbox = await station.kit.outbox("dec-send");
    expect(outbox).toMatchObject({ state: "sent", receipt: expect.any(String) });
    const waits = await station.kit.waits(parked.runId);
    expect(waits).toEqual([
      expect.objectContaining({
        state: "open",
        reason: "reply",
        mailboxId: "box-a",
        threadId: "thread-dec-send",
      }),
    ]);
  });

  it("3. a second Approve on sent replays; parked_failed does not call again", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-replay"));
    const first = await station.send.approve("dec-replay");
    const second = await station.send.approve("dec-replay");
    expect(second.sendId).toBe(first.sendId);
    expect(await station.send.providerCallCount(first.sendId)).toBe(1);

    const failed = await station.kit.parkInbound(inbound("dec-failed", "thread-failed"));
    await station.kit.armProviderFailure("dec-failed");
    await expect(station.send.approve("dec-failed")).rejects.toMatchObject({
      code: "send.provider_failed",
      retryable: true,
    });
    expect(await station.kit.outbox("dec-failed")).toMatchObject({
      state: "parked_failed",
      attempts: 1,
      receipt: null,
    });
    expect(await station.send.decisionState("dec-failed")).toBe("parked");
    await expect(station.send.approve("dec-failed")).rejects.toMatchObject({
      code: "send.already_attempted",
    });
    expect(await station.send.providerCallCount(failed.sendId)).toBe(1);
  });

  it("4. a reply on the same mailbox and thread resumes the run and does not send", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-reply"));
    const receipt = await station.send.approve("dec-reply");
    const next = await station.kit.resumeReply({
      mailboxId: "box-a",
      threadId: "thread-dec-reply",
      body: "the reply",
    });
    expect(next.runId).toBe(parked.runId);
    expect(await station.send.decisionState(next.decisionId)).toBe("parked");
    expect(await station.kit.outbox(next.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(receipt.sendId)).toBe(1);
    expect(await station.kit.waits(parked.runId)).toEqual([
      expect.objectContaining({ state: "resumed", reason: "reply" }),
    ]);
  });

  it("5. Kill after sent drops the park row, kills the outbox, and releases the lease", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-kill-sent"));
    const receipt = await station.send.approve("dec-kill-sent");
    await station.schema.acquireLease("email:dec-kill-sent", "w1");
    await station.send.kill("dec-kill-sent");
    expect(await station.send.decisionState("dec-kill-sent")).toBe("dropped");
    expect(await station.kit.outbox("dec-kill-sent")).toMatchObject({ state: "killed" });
    expect(await station.kit.waits(parked.runId)).toEqual([
      expect.objectContaining({ state: "dead" }),
    ]);
    await expect(station.schema.acquireLease("email:dec-kill-sent", "w2")).resolves.toBeUndefined();
    expect(await station.send.providerCallCount(receipt.sendId)).toBe(1);
    await expect(station.send.approve("dec-kill-sent")).rejects.toMatchObject({
      code: "send.killed",
    });
  });

  it("6. a second Approve while queued with no receipt is send.in_flight", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-flight"));
    await station.kit.armCrash("dec-flight", "before-receipt");
    await expect(station.send.approve("dec-flight")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    expect(await station.kit.outbox("dec-flight")).toMatchObject({
      state: "queued",
      receipt: null,
    });
    expect(await station.send.decisionState("dec-flight")).toBe("sending");
    await expect(station.send.approve("dec-flight")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("7. a context read for tenant A does not return tenant B", async () => {
    const station = getStation({ seed: false });
    await station.kit.writeContext({
      id: "rec-b",
      tenantId: "tenant-b",
      body: "tenant-b-only-secret",
      kind: "client",
      actor: "station",
    });
    const rows = await station.kit.readContext("tenant-a");
    expect(rows.map((row) => row.body).join("\n")).not.toMatch(/tenant-b-only-secret/);
  });

  it("8. boot scan completes queued plus receipt without a provider call", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-boot"));
    await station.kit.armCrash("dec-boot", "before-receipt");
    await expect(station.send.approve("dec-boot")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    await station.kit.postReceipt("dec-boot", { receipt: "msg-boot" });
    const scan = await station.kit.bootScan();
    expect(scan.completed).toContain(parked.sendId);
    expect(await station.kit.outbox("dec-boot")).toMatchObject({
      state: "sent",
      receipt: "msg-boot",
    });
    expect(await station.send.decisionState("dec-boot")).toBe("sent");
    expect(await station.kit.waits(parked.runId)).toEqual([
      expect.objectContaining({ state: "open", threadId: "thread-dec-boot" }),
    ]);
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("9. Kill while queued drops a late success and a later Approve is send.killed", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-late"));
    await station.kit.armCrash("dec-late", "before-receipt");
    await expect(station.send.approve("dec-late")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    await station.send.kill("dec-late");
    await station.kit.settleInFlight("dec-late", { receipt: "msg-late", threadId: "prov-late" });
    expect(await station.send.decisionState("dec-late")).toBe("dropped");
    expect(await station.kit.outbox("dec-late")).toMatchObject({
      state: "killed",
      receipt: null,
    });
    expect(await station.kit.waits(parked.runId)).toEqual([]);
    await expect(station.send.approve("dec-late")).rejects.toMatchObject({
      code: "send.killed",
    });
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("10. POST receipt stores the id and the boot scan completes sent", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-receipt"));
    await station.kit.armCrash("dec-receipt", "before-receipt");
    await expect(station.send.approve("dec-receipt")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "kit-token" });
    try {
      const posted = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/park/dec-receipt/receipt",
        method: "POST",
        headers: {
          authorization: "Bearer kit-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ receipt: "msg-http", threadId: "prov-thread" }),
      });
      expect(posted.status).toBe(200);
    } finally {
      await bound.close();
    }
    expect(await station.kit.outbox("dec-receipt")).toMatchObject({
      state: "queued",
      receipt: "msg-http",
    });
    await station.kit.bootScan();
    expect(await station.send.decisionState("dec-receipt")).toBe("sent");
    expect(await station.kit.waits(parked.runId)).toEqual([
      expect.objectContaining({ state: "open", threadId: "prov-thread" }),
    ]);
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("stores a provider thread id with the receipt, and keeps the inbound id when the field is absent", async () => {
    const station = getStation({ seed: false });
    const withThread = await station.kit.parkInbound(inbound("dec-thread"));
    await station.kit.armProviderThread("dec-thread", "from-provider");
    await station.send.approve("dec-thread");
    expect(await station.kit.waits(withThread.runId)).toEqual([
      expect.objectContaining({ threadId: "from-provider" }),
    ]);

    const plain = await station.kit.parkInbound(inbound("dec-plain", "thread-plain"));
    await station.kit.armCrash("dec-plain", "before-receipt");
    await expect(station.send.approve("dec-plain")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    await station.kit.postReceipt("dec-plain", { receipt: "msg-plain" });
    await station.kit.bootScan();
    expect(await station.kit.waits(plain.runId)).toEqual([
      expect.objectContaining({ threadId: "thread-plain" }),
    ]);
  });

  it("a second open reply wait on the same mailbox and thread is run.wait_conflict", async () => {
    const station = getStation({ seed: false });
    await station.kit.parkInbound(inbound("dec-wait-a", "thread-shared"));
    await station.send.approve("dec-wait-a");
    const second = await station.kit.parkInbound(inbound("dec-wait-b", "thread-shared"));
    await expect(station.send.approve("dec-wait-b")).rejects.toMatchObject({
      code: "run.wait_conflict",
    });
    expect(await station.send.decisionState("dec-wait-b")).toBe("sent");
    expect(await station.send.providerCallCount(second.sendId)).toBe(1);
    const open = (await station.kit.waits(second.runId)).filter((row) => row.state === "open");
    expect(open).toHaveLength(0);
  });

  it("a due timer parks a draft and does not send", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound(inbound("dec-timer"));
    await station.send.approve("dec-timer");
    await station.kit.insertTimer({
      runId: parked.runId,
      tenantId: "tenant-a",
      mailboxId: "box-a",
      threadId: "thread-dec-timer",
      wakeAt: "2000-01-01T00:00:00.000Z",
    });
    const woken = await station.kit.wakeDueTimers("2000-01-01T00:00:01.000Z");
    expect(woken.decisionId).toBeTruthy();
    expect(await station.send.decisionState(woken.decisionId)).toBe("parked");
    expect(await station.kit.outbox(woken.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("a restarted station finishes a receipted send and does not call the provider", async () => {
    const catalog = "memory://t32-restart-receipt";
    const first = getStation({ seed: false });
    first.config.load({ STATION_DATABASE_URL: catalog });
    const parked = await first.kit.parkInbound(inbound("dec-restart"));
    await first.kit.armCrash("dec-restart", "before-receipt");
    await expect(first.send.approve("dec-restart")).rejects.toMatchObject({ code: "send.in_flight" });
    await first.kit.postReceipt("dec-restart", { receipt: "msg-restart", threadId: "prov-restart" });
    await first.kit.writeContext({
      id: "rec-restart",
      tenantId: "tenant-a",
      body: "kept-across-restart",
      kind: "client",
      actor: "station",
    });
    expect(await first.send.providerCallCount(parked.sendId)).toBe(1);

    const second = getStation({ seed: false });
    second.config.load({ STATION_DATABASE_URL: catalog });
    const bound = await second.worker.listen({ host: "127.0.0.1", token: "restart" });
    await bound.close();
    expect(await second.send.decisionState("dec-restart")).toBe("sent");
    expect(await second.kit.outbox("dec-restart")).toMatchObject({
      state: "sent",
      receipt: "msg-restart",
    });
    expect(await second.kit.waits(parked.runId)).toEqual([
      expect.objectContaining({ state: "open", threadId: "prov-restart" }),
    ]);
    expect(await second.send.providerCallCount(parked.sendId)).toBe(0);
    const context = await second.kit.readContext("tenant-a");
    expect(context.map((row) => row.body)).toContain("kept-across-restart");
  });

  it("a restarted station leaves a receipt-less send in flight", async () => {
    const catalog = "memory://t32-restart-flight";
    const first = getStation({ seed: false });
    first.config.load({ STATION_DATABASE_URL: catalog });
    const parked = await first.kit.parkInbound(inbound("dec-flight-restart"));
    await first.kit.armCrash("dec-flight-restart", "before-receipt");
    await expect(first.send.approve("dec-flight-restart")).rejects.toMatchObject({
      code: "send.in_flight",
    });

    const second = getStation({ seed: false });
    second.config.load({ STATION_DATABASE_URL: catalog });
    const bound = await second.worker.listen({ host: "127.0.0.1", token: "restart" });
    await bound.close();
    expect(await second.send.decisionState("dec-flight-restart")).toBe("sending");
    expect(await second.kit.outbox("dec-flight-restart")).toMatchObject({
      state: "queued",
      receipt: null,
    });
    expect(await second.kit.waits(parked.runId)).toEqual([]);
    await expect(second.send.approve("dec-flight-restart")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    expect(await second.send.providerCallCount(parked.sendId)).toBe(0);
  });
});

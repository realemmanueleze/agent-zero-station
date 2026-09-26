import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("T3 send", () => {
  it("two parallel Approves: one sent, one replays the same Receipt", async () => {
    const [a, b] = await Promise.all([
      station.send.approve("dec-1"),
      station.send.approve("dec-1"),
    ]);
    expect(a.sendId).toBe(b.sendId);
    expect(await station.send.decisionState("dec-1")).toBe("sent");
    expect(await station.send.providerCallCount(a.sendId)).toBe(1);
  });

  it("commitSend provider failure stays parked and is retryable", async () => {
    await station.kit.armProviderFailure("dec-fail");
    await expect(station.send.approve("dec-fail")).rejects.toMatchObject({
      code: "send.provider_failed",
      retryable: true,
    });
    expect(await station.send.decisionState("dec-fail")).toBe("parked");
    expect(await station.kit.outbox("dec-fail")).toMatchObject({
      state: "parked_failed",
      attempts: 1,
      receipt: null,
    });
    expect(await station.send.providerCallCount("send-fail")).toBe(1);
    await expect(station.send.approve("dec-fail")).rejects.toMatchObject({
      code: "send.already_attempted",
    });
    expect(await station.send.providerCallCount("send-fail")).toBe(1);
  });

  it("crash before receipt is send.in_flight and does not call the provider again", async () => {
    const parked = getStation({ seed: false });
    const row = await parked.kit.parkInbound({
      id: "dec-crash-live",
      tenantId: "tenant-a",
      mailboxId: "box-a",
      threadId: "thread-crash",
      body: "draft",
    });
    await parked.kit.armCrash("dec-crash-live", "before-receipt");
    await expect(parked.send.approve("dec-crash-live")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    await expect(parked.send.approve("dec-crash-live")).rejects.toMatchObject({
      code: "send.in_flight",
    });
    expect(await parked.send.providerCallCount(row.sendId)).toBe(1);
  });

  it("kill on parked drops; kill after sent keeps the public state dropped", async () => {
    await station.send.kill("dec-parked");
    expect(await station.send.decisionState("dec-parked")).toBe("dropped");
    const sent = getStation({ seed: false });
    const row = await sent.kit.parkInbound({
      id: "dec-kill-after-sent",
      tenantId: "tenant-a",
      mailboxId: "box-a",
      threadId: "thread-kill",
      body: "draft",
    });
    const receipt = await sent.send.approve("dec-kill-after-sent");
    await sent.send.kill("dec-kill-after-sent");
    expect(await sent.send.decisionState("dec-kill-after-sent")).toBe("dropped");
    expect(await sent.kit.outbox("dec-kill-after-sent")).toMatchObject({ state: "killed" });
    expect(await sent.send.providerCallCount(receipt.sendId)).toBe(1);
    expect(row.sendId).toBe(receipt.sendId);
  });

  it("edit updates body, stays parked, and re-runs beforePark", async () => {
    const edited = await station.send.edit("dec-edit", "We can do 5% off");
    expect(edited.state).toBe("parked");
    expect(edited.body).not.toMatch(/50%|below floor/i);
  });

  it("Approve info logs do not contain the mail body", async () => {
    await station.send.approve("dec-log");
    const dumped = (await station.send.approveLogs("dec-log")).join("\n");
    expect(dumped).not.toMatch(/Quote for \$12400|confidential body/i);
  });
});

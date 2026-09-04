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
    await expect(
      station.send.commitSend({ sendId: "send-fail", fail: true }),
    ).rejects.toMatchObject({
      code: "send.provider_failed",
      retryable: true,
    });
    expect(await station.send.decisionState("dec-fail")).toBe("parked");
  });

  it("crash after provider accept stays sending and retry reuses sendId", async () => {
    expect(await station.send.decisionState("dec-crash")).toBe("sending");
    const receipt = await station.send.approve("dec-crash");
    expect(await station.send.providerCallCount(receipt.sendId)).toBe(1);
  });

  it("kill on parked drops; kill on sent is send.already_sent", async () => {
    await station.send.kill("dec-parked");
    expect(await station.send.decisionState("dec-parked")).toBe("dropped");
    await expect(station.send.kill("dec-sent")).rejects.toMatchObject({
      code: "send.already_sent",
    });
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

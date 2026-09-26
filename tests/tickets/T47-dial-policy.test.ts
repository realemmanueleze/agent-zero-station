import { afterEach, describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { writeProposal } from "../../packages/station/src/learning.ts";
import {
  bootHolds,
  readDial,
  recheckHold,
  setDial,
  snapshotHolds,
  toolMayChangeDial,
  killHold,
} from "../../packages/station/src/dial.ts";

afterEach(() => {
  setDial("ask_me");
});

describe("T47 dial policy", () => {
  it("ask_me parks at human review and does not send", async () => {
    setDial("ask_me");
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t47-ask",
      tenantId: "tenant-a",
      mailboxId: "box-t47",
      threadId: "thread-t47-ask",
      body: "Need a consult.",
    });
    const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
    const slip = (listed.json as { items: Array<{ id: string; phase?: string; state: string }> }).items.find(
      (item) => item.id === parked.decisionId,
    );
    expect(slip).toMatchObject({ state: "parked", phase: "human_review" });
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
  });

  it("just_do holds and does not call the provider", async () => {
    setDial("just_do");
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t47-hold",
      tenantId: "tenant-a",
      mailboxId: "box-t47",
      threadId: "thread-t47-hold",
      body: "Just do this.",
    });
    expect(recheckHold(parked.decisionId)).toBe("held");
    expect(await station.kit.outbox(parked.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
  });

  it("never throws policy.denied and sends nothing", async () => {
    setDial("never");
    const station = getStation({ seed: false });
    await expect(
      station.kit.parkInbound({
        id: "t47-never",
        tenantId: "tenant-a",
        mailboxId: "box-t47",
        threadId: "thread-t47-never",
        body: "Do not send.",
      }),
    ).rejects.toMatchObject({ code: "policy.denied", status: 403 });
    expect(await station.send.providerCallCount("send-t47-never")).toBe(0);
  });

  it("a tool and learning cannot change the dial", () => {
    setDial("ask_me");
    expect(toolMayChangeDial("set_dial")).toBe(false);
    writeProposal({
      packId: "sales",
      date: "2026-09-26",
      outcomes: [],
      root: "/tmp/station-t47-learning",
    });
    expect(readDial()).toBe("ask_me");
  });

  it("a hold survives restart until Kill", async () => {
    setDial("just_do");
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t47-restart",
      tenantId: "tenant-a",
      mailboxId: "box-t47",
      threadId: "thread-t47-restart",
      body: "Hold this.",
    });
    bootHolds(snapshotHolds());
    expect(recheckHold(parked.decisionId)).toBe("held");
    killHold(parked.decisionId);
    expect(recheckHold(parked.decisionId)).toBe("cancelled");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
  });
});

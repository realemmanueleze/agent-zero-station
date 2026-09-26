import { afterEach, describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { recheckHold, setDial } from "../../packages/station/src/dial.ts";

afterEach(() => {
  setDial("ask_me");
});

describe("rail.dial (gate: merge)", () => {
  it("never sends nothing, and just_do holds without a provider call", async () => {
    setDial("never");
    const denied = getStation({ seed: false });
    await expect(
      denied.kit.parkInbound({
        id: "eval-never",
        tenantId: "tenant-a",
        mailboxId: "box-eval-dial",
        threadId: "thread-eval-never",
        body: "No.",
      }),
    ).rejects.toMatchObject({ code: "policy.denied" });

    setDial("just_do");
    const held = getStation({ seed: false });
    const parked = await held.kit.parkInbound({
      id: "eval-hold",
      tenantId: "tenant-a",
      mailboxId: "box-eval-dial",
      threadId: "thread-eval-hold",
      body: "Hold.",
    });
    expect(recheckHold(parked.decisionId)).toBe("held");
    expect(await held.send.providerCallCount(parked.sendId)).toBe(0);
  });
});

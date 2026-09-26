import { describe, expect, it } from "vitest";
import { ledgerSentence } from "../../apps/cockpit/src/ui/park-action.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";
import { getStation } from "@station/api";

describe("rail.park (gate: merge)", () => {
  it("Approve sends once, and Edit and Kill do not", async () => {
    const station = getStation({ seed: false });
    const approved = await station.kit.parkInbound({
      id: "eval-approve",
      tenantId: "tenant-a",
      mailboxId: "box-eval-rail",
      threadId: "thread-eval-approve",
      body: "Please send the note.",
    });
    await station.send.approve(approved.decisionId);
    expect(await station.send.providerCallCount(approved.sendId)).toBe(1);
    const sent = await station.cockpit.parkList({ host: "127.0.0.1" });
    const items = (sent.json as { items: ParkItem[] }).items;
    const slip = items.find((item) => item.id === approved.decisionId);
    expect(ledgerSentence(slip!, items)).toBe("Sent. Watching for a reply.");

    const edited = await station.kit.parkInbound({
      id: "eval-edit",
      tenantId: "tenant-a",
      mailboxId: "box-eval-rail",
      threadId: "thread-eval-edit",
      body: "Hold this draft.",
    });
    await station.send.edit(edited.decisionId, "Edited on the desk");
    expect(await station.send.providerCallCount(edited.sendId)).toBe(0);

    const killed = await station.kit.parkInbound({
      id: "eval-kill",
      tenantId: "tenant-a",
      mailboxId: "box-eval-rail",
      threadId: "thread-eval-kill",
      body: "Drop this draft.",
    });
    await station.send.kill(killed.decisionId);
    expect(await station.send.providerCallCount(killed.sendId)).toBe(0);
    expect(await station.send.decisionState(killed.decisionId)).toBe("dropped");
  });
});

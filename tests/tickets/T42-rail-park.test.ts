import { describe, expect, it } from "vitest";
import { ledgerSentence } from "../../apps/cockpit/src/ui/park-action.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";
import { getStation } from "@station/api";

type Slip = ParkItem & {
  actions?: string[];
  phase?: string | null;
  wait?: { state: string; reason: string } | null;
  outbox?: { state: string } | null;
};

async function desk(seed = false) {
  const station = getStation({ seed });
  const bound = await station.worker.listen({ host: "127.0.0.1", token: "t42" });
  const headers = { authorization: "Bearer t42", "content-type": "application/json" };
  const call = (path: string, method = "GET", body?: string) =>
    station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path,
      method,
      headers,
      body,
    });
  const slips = async () => {
    const listed = await call("/park");
    return (listed.json as { items: Slip[] }).items;
  };
  return { station, bound, call, slips };
}

describe("T42 rail park", () => {
  it("human_review is a parked slip with Approve, Edit, and Kill", async () => {
    const { station, bound, slips } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t42-review",
      tenantId: "tenant-a",
      mailboxId: "box-t42",
      threadId: "thread-t42-review",
      body: "Can we book a consult?",
    });
    const slip = (await slips()).find((item) => item.id === parked.decisionId);
    expect(slip).toMatchObject({
      state: "parked",
      actions: ["Approve", "Edit", "Kill"],
      phase: "human_review",
    });
    expect(slip?.body?.length).toBeGreaterThan(0);
    expect(await station.kit.outbox(parked.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
    await bound.close();
  });

  it("Approve sends once through the outbox and pauses for a reply", async () => {
    const { station, bound, call, slips } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t42-send",
      tenantId: "tenant-a",
      mailboxId: "box-t42",
      threadId: "thread-t42-send",
      body: "Need a time this week.",
    });
    const approved = await call(`/park/${parked.decisionId}/approve`, "POST");
    expect(approved.status).toBe(200);
    const replay = await call(`/park/${parked.decisionId}/approve`, "POST");
    expect(replay.status).toBe(200);
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    expect(await station.kit.outbox(parked.decisionId)).toMatchObject({ state: "sent" });
    expect(await station.kit.waits(parked.runId)).toEqual([
      expect.objectContaining({ state: "open", reason: "reply" }),
    ]);
    const items = await slips();
    const slip = items.find((item) => item.id === parked.decisionId);
    expect(slip?.state).toBe("sent");
    expect(slip?.phase).toBe("wait_for_reply");
    expect(ledgerSentence(slip!, items)).toBe("Sent. Watching for a reply.");
    await bound.close();
  });

  it("Edit replaces the draft and does not send", async () => {
    const { station, bound, call, slips } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t42-edit",
      tenantId: "tenant-a",
      mailboxId: "box-t42",
      threadId: "thread-t42-edit",
      body: "First draft source.",
    });
    const edited = await call(
      `/park/${parked.decisionId}/edit`,
      "POST",
      JSON.stringify({ body: "Hello from the desk" }),
    );
    expect(edited.status).toBe(200);
    const slip = (await slips()).find((item) => item.id === parked.decisionId);
    expect(slip).toMatchObject({ state: "parked", phase: "human_review", body: "Hello from the desk" });
    expect(await station.kit.outbox(parked.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
    await bound.close();
  });

  it("Edit after an outbox row is 409", async () => {
    const { station, bound, call } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t42-edit-closed",
      tenantId: "tenant-a",
      mailboxId: "box-t42",
      threadId: "thread-t42-edit-closed",
      body: "Send this first.",
    });
    await call(`/park/${parked.decisionId}/approve`, "POST");
    const edited = await call(
      `/park/${parked.decisionId}/edit`,
      "POST",
      JSON.stringify({ body: "too late" }),
    );
    expect(edited.status).toBe(409);
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    await bound.close();
  });

  it("Kill before send does not call the provider", async () => {
    const { station, bound, call, slips } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t42-kill",
      tenantId: "tenant-a",
      mailboxId: "box-t42",
      threadId: "thread-t42-kill",
      body: "Do not send.",
    });
    const killed = await call(`/park/${parked.decisionId}/kill`, "POST");
    expect(killed.status).toBe(200);
    const items = await slips();
    const slip = items.find((item) => item.id === parked.decisionId);
    expect(slip?.state).toBe("dropped");
    expect(ledgerSentence(slip!, items)).toBe("Killed. Nothing was sent.");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(0);
    await bound.close();
  });
});

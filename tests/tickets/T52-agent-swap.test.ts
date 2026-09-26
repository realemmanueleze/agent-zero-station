import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { fakeDraftModel } from "../../packages/loop/src/drafter.ts";

type Slip = { id: string; phase?: string | null; body?: string };

async function slip(station: ReturnType<typeof getStation>, id: string): Promise<Slip> {
  const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
  const row = (listed.json as { items: Slip[] }).items.find((item) => item.id === id);
  expect(row).toBeTruthy();
  return row as Slip;
}

async function parkedRun(
  id: string,
  model?: ReturnType<typeof fakeDraftModel>,
): Promise<{ runId: string; sendId: string; body: string }> {
  const station = getStation({ seed: false });
  if (model) {
    await station.kit.armDrafter(model);
  }
  const parked = await station.kit.parkInbound({
    id,
    tenantId: "tenant-a",
    mailboxId: `box-${id}`,
    threadId: `thread-${id}`,
    body: "Hello lead",
  });
  const card = await slip(station, id);
  expect(card.phase).toBe("human_review");
  await station.send.approve(id);
  await station.send.approve(id);
  expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  const resumed = await station.kit.resumeReply({
    mailboxId: `box-${id}`,
    threadId: `thread-${id}`,
    body: "Thanks, let's talk",
  });
  expect(resumed.runId).toBe(parked.runId);
  return { runId: parked.runId, sendId: parked.sendId, body: card.body ?? "" };
}

describe("T52 agent swap", () => {
  it("pack-unseen-engine and the Deep Agents drafter both pause, send once, and keep the run", async () => {
    const pack = await parkedRun("dec-pack");
    expect(pack.body).toMatch(/unseen consult/);
    const agent = await parkedRun("dec-agent", fakeDraftModel());
    expect(agent.body).toContain("FAKE DRAFT");
    expect(agent.runId).not.toBe(pack.runId);
  });

  it("an unknown pack is pack.unknown and does not become sales", async () => {
    const station = getStation({ seed: false });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t52" });
    try {
      const res = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/packs/nope/activate",
        method: "POST",
        headers: { authorization: "Bearer t52" },
      });
      expect(res.status).toBe(400);
      expect((res.json as { error: { code: string } }).error.code).toBe("pack.unknown");
      const listed = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/packs",
        method: "GET",
        headers: { authorization: "Bearer t52" },
      });
      expect((listed.json as { active: string }).active).not.toBe("nope");
    } finally {
      await bound.close();
    }
  });

  it("keeps GET /park, Approve, Edit body, and Kill", async () => {
    const station = getStation({ seed: false });
    await station.kit.parkInbound({
      id: "dec-api",
      tenantId: "tenant-a",
      mailboxId: "box-api",
      threadId: "thread-api",
      body: "Hello",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t52" });
    try {
      const listed = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/park",
        method: "GET",
        headers: { authorization: "Bearer t52" },
      });
      expect(listed.status).toBe(200);
      const edited = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/park/dec-api/edit",
        method: "POST",
        headers: { authorization: "Bearer t52", "content-type": "application/json" },
        body: JSON.stringify({ body: "Edited hello" }),
      });
      expect(edited.status).toBe(200);
      const killed = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/park/dec-api/kill",
        method: "POST",
        headers: { authorization: "Bearer t52" },
      });
      expect(killed.status).toBe(200);
      expect((killed.json as { state: string }).state).toBe("dropped");
    } finally {
      await bound.close();
    }
  });
});

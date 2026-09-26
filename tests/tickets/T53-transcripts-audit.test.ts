import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

type RecordRow = { id: string; body: string; kind: string; label?: string };

async function post(
  station: ReturnType<typeof getStation>,
  path: string,
  body: unknown,
): Promise<{ status: number; json: unknown }> {
  const bound = await station.worker.listen({ host: "127.0.0.1", token: "t53" });
  try {
    return await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path,
      method: "POST",
      headers: { authorization: "Bearer t53", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await bound.close();
  }
}

describe("T53 transcripts and open work", () => {
  it("a labeled transcript is stored and parks a next step without sending", async () => {
    const station = getStation({ seed: false });
    const posted = await post(station, "/transcripts", {
      id: "tr-1",
      tenantId: "tenant-a",
      actor: "carmen",
      label: "discovery",
      body: "They want a Thursday call",
      mailboxId: "box-tr",
      threadId: "thread-tr",
    });
    expect(posted.status).toBe(200);
    const rows = (await station.kit.readContext("tenant-a")) as RecordRow[];
    expect(rows).toEqual([
      expect.objectContaining({ id: "tr-1", label: "discovery", body: "They want a Thursday call" }),
    ]);
    const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
    const slip = (listed.json as { items: Array<{ state: string; body?: string }> }).items[0];
    expect(slip?.state).toBe("parked");
    expect(slip?.body ?? "").toMatch(/Thursday/);
    expect(await station.send.providerCallCount("send-tr-1")).toBe(0);
  });

  it("an unlabeled transcript is 400 and stays off the record", async () => {
    const station = getStation({ seed: false });
    const posted = await post(station, "/transcripts", {
      id: "tr-bad",
      tenantId: "tenant-a",
      actor: "carmen",
      body: "no label",
      mailboxId: "box-bad",
      threadId: "thread-bad",
    });
    expect(posted.status).toBe(400);
    expect(await station.kit.readContext("tenant-a")).toEqual([]);
  });

  it("open work parks a doc from a vault excerpt and an email and does not send", async () => {
    const station = getStation({ seed: false });
    const before = await station.worker.listen({ host: "127.0.0.1", token: "t53" });
    const prior = await station.worker.request({
      host: "127.0.0.1",
      port: before.port,
      path: "/workflows",
      method: "GET",
      headers: { authorization: "Bearer t53" },
    });
    await before.close();
    const posted = await post(station, "/open-work", {
      id: "doc-1",
      tenantId: "tenant-a",
      actor: "carmen",
      excerpt: "VAULT-EXCERPT-only",
      email: "EMAIL-THREAD-only",
      mailboxId: "box-doc",
      threadId: "thread-doc",
    });
    expect(posted.status).toBe(200);
    const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
    const slip = (listed.json as { items: Array<{ state: string; body?: string }> }).items[0];
    expect(slip?.state).toBe("parked");
    expect(slip?.body ?? "").toContain("VAULT-EXCERPT-only");
    expect(slip?.body ?? "").toContain("EMAIL-THREAD-only");
    expect(await station.send.providerCallCount("send-doc-1")).toBe(0);
    const after = await station.worker.listen({ host: "127.0.0.1", token: "t53" });
    try {
      const workflows = await station.worker.request({
        host: "127.0.0.1",
        port: after.port,
        path: "/workflows",
        method: "GET",
        headers: { authorization: "Bearer t53" },
      });
      expect(workflows.json).toEqual(prior.json);
    } finally {
      await after.close();
    }
  });
});

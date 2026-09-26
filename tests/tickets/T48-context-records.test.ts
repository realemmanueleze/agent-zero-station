import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StationError } from "@station/observability";
import { getStation } from "@station/api";

describe("T48 context records", () => {
  it("a record stores a kind and a named actor", async () => {
    const station = getStation({ seed: false });
    await station.kit.writeContext({
      id: "rec-lead",
      tenantId: "tenant-a",
      body: "Jordan at Northwind",
      kind: "lead",
      actor: "carmen",
    });
    const rows = await station.kit.readContext("tenant-a");
    expect(rows).toEqual([
      expect.objectContaining({ id: "rec-lead", kind: "lead", actor: "carmen" }),
    ]);
  });

  it("a missing actor fails and writes nothing", async () => {
    const station = getStation({ seed: false });
    await expect(
      station.kit.writeContext({
        id: "rec-silent",
        tenantId: "tenant-a",
        body: "no actor",
        kind: "lead",
        actor: "",
      }),
    ).rejects.toBeInstanceOf(StationError);
    expect(await station.kit.readContext("tenant-a")).toEqual([]);
  });

  it("a lead webhook upserts one row for that tenant and does not send", async () => {
    const station = getStation({ seed: false });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t48" });
    try {
      const posted = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/hooks/lead",
        method: "POST",
        headers: { authorization: "Bearer t48", "content-type": "application/json" },
        body: JSON.stringify({
          id: "lead-1",
          tenantId: "tenant-a",
          body: "New lead",
          actor: "webhook",
        }),
      });
      expect(posted.status).toBe(200);
      const again = await station.worker.request({
        host: "127.0.0.1",
        port: bound.port,
        path: "/hooks/lead",
        method: "POST",
        headers: { authorization: "Bearer t48", "content-type": "application/json" },
        body: JSON.stringify({
          id: "lead-1",
          tenantId: "tenant-a",
          body: "New lead, updated",
          actor: "webhook",
        }),
      });
      expect(again.status).toBe(200);
      const rows = await station.kit.readContext("tenant-a");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: "lead-1", kind: "lead", body: "New lead, updated" });
      expect(await station.kit.readContext("tenant-b")).toEqual([]);
      expect(await station.send.providerCallCount("send-lead-1")).toBe(0);
      expect(await station.send.decisionState("lead-1").catch(() => "absent")).toBe("absent");
    } finally {
      await bound.close();
    }
  });

  it("does not depend on DripJobs or HubSpot", () => {
    const root = readFileSync("package.json", "utf8");
    const station = readFileSync("packages/station/package.json", "utf8");
    expect(`${root}\n${station}`).not.toMatch(/dripjobs|hubspot/i);
  });
});

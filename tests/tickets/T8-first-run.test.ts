import { describe, expect, it } from "vitest";
import { startStation } from "@station/runtime";

describe("T8 first run", () => {
  it("cockpit /park is 200 with HITL actions and no control token", async () => {
    const token = "test-control-token-value";
    const runtime = await startStation({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
    });
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.cockpitPort}/park`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/Approve|approve/i);
      expect(html).toMatch(/Edit|edit/i);
      expect(html).toMatch(/Kill|kill/i);
      expect(html).toMatch(/parked/i);
      expect(html).not.toContain("STATION_CONTROL_TOKEN");
      expect(html).not.toContain(token);
      expect(html).not.toContain(`Bearer ${token}`);
    } finally {
      await runtime.close();
    }
  });

  it("GET /park.json lists a parked fixture", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.cockpitPort}/park.json`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ state: string }> };
      expect(body.items.some((item) => item.state === "parked")).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it("cockpit Approve sends and never leaks the control token", async () => {
    const token = "approve-secret-token";
    const runtime = await startStation({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
    });
    try {
      const listed = (await (
        await fetch(`http://127.0.0.1:${runtime.cockpitPort}/park.json`)
      ).json()) as { items: Array<{ id: string; state: string }> };
      const parked = listed.items.find((item) => item.state === "parked");
      expect(parked).toBeTruthy();
      const res = await fetch(
        `http://127.0.0.1:${runtime.cockpitPort}/park/${parked?.id}/approve`,
        { method: "POST" },
      );
      expect(res.status).toBe(200);
      const after = (await res.json()) as { state?: string; error?: { code?: string } };
      expect(after.error).toBeUndefined();
      const html = await (
        await fetch(`http://127.0.0.1:${runtime.cockpitPort}/park`)
      ).text();
      expect(html).not.toContain(token);
      const again = (await (
        await fetch(`http://127.0.0.1:${runtime.cockpitPort}/park.json`)
      ).json()) as { items: Array<{ id: string; state: string }> };
      expect(again.items.find((item) => item.id === parked?.id)?.state).toBe("sent");
    } finally {
      await runtime.close();
    }
  });

  it("worker rejects LAN hosts", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      await expect(
        fetch(`http://10.0.0.5:${runtime.workerPort}/health`, { signal: AbortSignal.timeout(400) }),
      ).rejects.toBeTruthy();
    } finally {
      await runtime.close();
    }
  });

  it("loading demo fixtures twice still yields one parked fixture row", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      await runtime.station.schema.loadFixtureFile("fixtures/demo.jsonl");
      expect(await runtime.station.schema.countParked()).toBe(1);
    } finally {
      await runtime.close();
    }
  });
});

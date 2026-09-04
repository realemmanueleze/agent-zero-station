import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { activityFromLedger } from "../../apps/cockpit/src/ui/workspace.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

const MASTER = "local-dev-master-key-32-bytes!!!!";

describe("T21 ledger cockpit", () => {
  it("activityFromLedger has decisions only", () => {
    const items: ParkItem[] = [
      { id: "demo-1", state: "parked", subject: "Draft quote", channel: "email", accountId: "work@acme.com" },
    ];
    const rows = activityFromLedger(items);
    expect(rows.some((row) => row.signalId === "demo-1")).toBe(true);
    expect(rows.some((row) => row.id === "log-slack-1")).toBe(false);
  });

  it("GET /activity and /brief read the ledger", async () => {
    const station = getStation({ seed: false });
    station.config.load({ STATION_MASTER_KEY: MASTER });
    await station.schema.loadFixtureFile("fixtures/demo.jsonl");
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t21" });
    try {
      const activity = await fetch(`http://127.0.0.1:${bound.port}/activity`, {
        headers: { authorization: "Bearer t21" },
      });
      const json = (await activity.json()) as { items: Array<{ id: string; detail: string }> };
      expect(json.items.some((row) => row.id.startsWith("decision-"))).toBe(true);
      expect(JSON.stringify(json)).not.toContain("STATION_MASTER_KEY");
      expect(JSON.stringify(json)).not.toContain(MASTER);

      const brief = await fetch(`http://127.0.0.1:${bound.port}/brief?q=quote`, {
        headers: { authorization: "Bearer t21" },
      });
      const body = (await brief.json()) as { brief: string };
      expect(body.brief).toMatch(/waiting|Query/i);
    } finally {
      await bound.close();
    }
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

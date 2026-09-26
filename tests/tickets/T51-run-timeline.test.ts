import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { tickWord } from "../../apps/cockpit/src/ui/park-action.ts";

type ActivityRow = {
  id: string;
  phase?: string;
  sentence?: string;
  action: string;
};

async function activity(station: ReturnType<typeof getStation>): Promise<ActivityRow[]> {
  const bound = await station.worker.listen({ host: "127.0.0.1", token: "t51" });
  try {
    const res = await station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path: "/activity",
      method: "GET",
      headers: { authorization: "Bearer t51" },
    });
    return (res.json as { items: ActivityRow[] }).items;
  } finally {
    await bound.close();
  }
}

describe("T51 run timeline", () => {
  it("activity lists drafted and waiting for Approve, then sent and waiting for reply", async () => {
    const station = getStation({ seed: false });
    await station.kit.parkInbound({
      id: "dec-run",
      tenantId: "tenant-a",
      mailboxId: "box-run",
      threadId: "thread-run",
      body: "Hello lead",
    });
    const parked = (await activity(station)).filter((row) => row.id.includes("dec-run"));
    expect(parked.map((row) => row.phase)).toEqual(["drafted", "waiting for Approve"]);
    expect(parked.map((row) => row.sentence)).toEqual(["Parked.", "Parked."]);
    expect(parked.map((row) => tickWord(row.sentence ?? ""))).toEqual(["Parked", "Parked"]);

    await station.send.approve("dec-run");
    const sent = (await activity(station)).filter((row) => row.id.includes("dec-run"));
    expect(sent.map((row) => row.phase)).toEqual(["sent", "waiting for reply"]);
    expect(sent.map((row) => row.sentence)).toEqual([
      "Sent. Watching for a reply.",
      "Sent. Watching for a reply.",
    ]);
    expect(new Set(sent.map((row) => tickWord(row.sentence ?? "")))).toEqual(new Set(["Sent"]));
  });

  it("keeps Activity, Brief, and the connection list on the existing sentences", () => {
    const activityView = readFileSync("apps/cockpit/src/ui/ActivityView.tsx", "utf8");
    const brief = readFileSync("apps/cockpit/src/ui/BriefView.tsx", "utf8");
    const connections = readFileSync("apps/cockpit/src/ui/ConnectionView.tsx", "utf8");
    expect(activityView).toMatch(/sentenceForState/);
    expect(brief).toMatch(/activityFromLedger/);
    expect(connections).toMatch(/ledgerSentence/);
    expect(readdirSync("apps/cockpit/src/app")).not.toContain("timeline");
    expect(existsSync("apps/cockpit/src/ui/Timeline.tsx")).toBe(false);
  });
});

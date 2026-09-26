import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { startStation } from "@station/runtime";
import { renderConnectionHtml } from "../../apps/cockpit/src/ui/command-deck.ts";
import { renderScreenStateHtml } from "../../apps/cockpit/src/ui/screen-state.ts";
import { cycleTheme } from "../../apps/cockpit/src/ui/theme.ts";
import { kindHasParkQueue } from "../../apps/cockpit/src/ui/workspace.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

const slackParked: ParkItem = {
  id: "slack-park-1",
  state: "parked",
  channel: "slack",
  accountId: "acme-hq",
  subject: "Follow up in #inbound",
  body: "Need a human on the quote thread.",
};

describe("T29 station rebuild", () => {
  it("approve fallback to sent is gone from the action hook", () => {
    const src = readFileSync(join(process.cwd(), "apps/cockpit/src/ui/useParkActions.ts"), "utf8");
    expect(src).toMatch(/interpretParkAction/);
    expect(src).not.toMatch(/json\.state \?\? \(action === "approve" \? "sent"/);
  });

  it("PacksDeck does not hardcode the initial pack as sales", () => {
    const src = readFileSync(join(process.cwd(), "apps/cockpit/src/ui/PacksDeck.tsx"), "utf8");
    expect(src).not.toMatch(/useState<PackId>\("sales"\)/);
    expect(src).toMatch(/initialActive/);
  });

  it("ConnectionView reads ledger activity and parks Slack", () => {
    const src = readFileSync(join(process.cwd(), "apps/cockpit/src/ui/ConnectionView.tsx"), "utf8");
    expect(src).not.toMatch(/buildActivity\(items\)/);
    expect(src).toMatch(/activityFromLedger|events/);
    expect(kindHasParkQueue("email")).toBe(true);
    expect(kindHasParkQueue("slack")).toBe(true);
    expect(kindHasParkQueue("obsidian")).toBe(false);
    const html = renderConnectionHtml("slack", "acme-hq", [slackParked]);
    expect(html).toMatch(/Approve|approve/i);
    expect(html).not.toMatch(/#inbound mentioned a quote follow-up/);
  });

  it("screen states are named and announced", () => {
    const loading = renderScreenStateHtml("loading", "Loading the park list");
    const error = renderScreenStateHtml("error", "Worker is not reachable");
    const empty = renderScreenStateHtml("empty", "Nothing parked");
    const ready = renderScreenStateHtml("ready", "3 waiting");
    expect(loading).toMatch(/role="status"/);
    expect(error).toMatch(/role="alert"/);
    expect(empty).toMatch(/screen-state is-empty/);
    expect(ready).toMatch(/screen-state is-ready/);
  });

  it("theme cycles system → light → dark → high-contrast", () => {
    expect(cycleTheme("system")).toBe("light");
    expect(cycleTheme("light")).toBe("dark");
    expect(cycleTheme("dark")).toBe("high-contrast");
    expect(cycleTheme("high-contrast")).toBe("system");
  });

  it("GET /packs reports the active pack after a switch", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      const activated = await fetch(
        `http://127.0.0.1:${runtime.cockpitPort}/packs/inbox-triage/activate`,
        { method: "POST" },
      );
      expect(activated.status).toBe(200);
      const listed = await fetch(`http://127.0.0.1:${runtime.workerPort}/packs`, {
        headers: { authorization: `Bearer ${process.env.STATION_CONTROL_TOKEN ?? "dev-control-token"}` },
      });
      const json = (await listed.json()) as { active?: string };
      expect(json.active).toBe("inbox-triage");
      const page = await (await fetch(`http://127.0.0.1:${runtime.cockpitPort}/packs`)).text();
      expect(page).toMatch(/Active: inbox-triage|active pack is inbox-triage/i);
    } finally {
      await runtime.close();
    }
  });

  it("rebuild docs stay the command desk, not EEF Learn", () => {
    const design = readFileSync(join(process.cwd(), "docs/DESIGN.md"), "utf8");
    const plan = readFileSync(join(process.cwd(), "docs/plans/station-rebuild.md"), "utf8");
    expect(design).not.toMatch(/Satoshi|ember-400|constellation/);
    expect(plan).toMatch(/command-station|command desk/i);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

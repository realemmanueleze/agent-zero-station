import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startStation } from "@station/runtime";
import { mailboxesFromConfig } from "@station/channels";
import { stationConfig } from "../../packages/station/src/station-config.ts";
import { renderAccountsHtml, renderPacksHtml } from "../../apps/cockpit/src/ui/pages.ts";

describe("T12 cockpit pages", () => {
  it("accounts HTML lists mailboxes and never leaks the control token", () => {
    const token = "accounts-secret-token";
    const html = renderAccountsHtml(mailboxesFromConfig(stationConfig), token);
    expect(html).toMatch(/work@acme.com/);
    expect(html).toMatch(/hello@acme.com/);
    expect(html).not.toContain("STATION_CONTROL_TOKEN");
    expect(html).not.toContain(token);
  });

  it("packs HTML lists sales and inbox-triage", () => {
    const html = renderPacksHtml("sales");
    expect(html).toMatch(/sales/);
    expect(html).toMatch(/inbox-triage/);
  });

  it("activating inbox-triage changes the active pack", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      const res = await fetch(
        `http://127.0.0.1:${runtime.cockpitPort}/packs/inbox-triage/activate`,
        { method: "POST" },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { packId?: string };
      expect(json.packId).toBe("inbox-triage");
      const page = await (await fetch(`http://127.0.0.1:${runtime.cockpitPort}/packs`)).text();
      expect(page).toMatch(/inbox-triage/);
    } finally {
      await runtime.close();
    }
  });

  it("THEMING.md states the token load order", () => {
    const md = readFileSync(join(process.cwd(), "docs/THEMING.md"), "utf8");
    expect(md).toMatch(/tokens\.css/);
    expect(md).toMatch(/station\.theme\.css/);
    expect(md).toMatch(/theme\.css/);
  });
});

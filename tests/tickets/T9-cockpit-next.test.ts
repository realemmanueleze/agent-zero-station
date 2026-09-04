import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandActions } from "../../apps/cockpit/src/ui/commands.ts";
import { getParkRenderer, registerParkRenderer, resetParkRenderers } from "../../apps/cockpit/src/ui/registry.ts";
import { renderParkCardHtml } from "../../apps/cockpit/src/ui/park-card.tsx";

const item = {
  id: "demo-1",
  state: "parked",
  subject: "Draft quote",
  body: "Need a quote",
  from: "jordan@northwind.io",
  packId: "sales",
  tenantId: "tenant-a",
};

describe("T9 Next cockpit", () => {
  it("ParkCard renders Approve, Edit, and Kill", () => {
    const html = renderParkCardHtml(item);
    expect(html).toMatch(/Approve|approve/i);
    expect(html).toMatch(/Edit|edit/i);
    expect(html).toMatch(/Kill|kill/i);
  });

  it("ParkCard never contains a control token", () => {
    const html = renderParkCardHtml(item);
    expect(html).not.toContain("STATION_CONTROL_TOKEN");
    expect(html).not.toContain("Bearer ");
  });

  it("registerParkRenderer replaces the default card for a pack", () => {
    resetParkRenderers();
    registerParkRenderer("sales", () => '<article data-pack="custom-sales">custom</article>');
    expect(getParkRenderer("sales")(item)).toContain("custom-sales");
    resetParkRenderers();
  });

  it("tokens.css defines the restyle surface", () => {
    const css = readFileSync(join(process.cwd(), "apps/cockpit/tokens.css"), "utf8");
    expect(css).toMatch(/--bg/);
    expect(css).toMatch(/--ink/);
    expect(css).toMatch(/--park-border/);
    expect(css).toMatch(/--mono/);
  });

  it("command palette lists Approve, Switch pack, and Toggle theme", () => {
    const labels = commandActions.map((row) => row.label).join(" ");
    expect(labels).toMatch(/Approve/i);
    expect(labels).toMatch(/Switch pack/i);
    expect(labels).toMatch(/Toggle theme/i);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandActions } from "./commands.ts";
import { getParkRenderer, registerParkRenderer, resetParkRenderers } from "./registry.ts";
import { renderParkCardHtml } from "./park-card.tsx";

const item = {
  id: "demo-1",
  state: "parked",
  subject: "Draft quote",
  body: "Need a quote",
  from: "jordan@northwind.io",
  packId: "sales",
  tenantId: "tenant-a",
};

describe("T9 Next cockpit primitives", () => {
  it("ParkCard renders Approve, Edit, and Kill", () => {
    const html = renderParkCardHtml(item);
    expect(html).toContain(">Approve<");
    expect(html).not.toContain(">Approve send<");
    expect(html).toMatch(/Edit|edit/i);
    expect(html).toMatch(/Kill|kill/i);
  });

  it("ParkCard money comes only from typed amount", () => {
    const scraped = renderParkCardHtml({
      ...item,
      subject: "Draft quote · $12,400",
      body: "Estimated contract $12400.",
    });
    expect(scraped).not.toContain('class="amount"');
    const typed = renderParkCardHtml({ ...item, amount: 12400 });
    expect(typed).toContain("$12,400");
  });

  it("ParkCard never contains a control token", () => {
    const html = renderParkCardHtml(item);
    expect(html).not.toContain("STATION_CONTROL_TOKEN");
    expect(html).not.toContain("Bearer ");
  });

  it("registerParkRenderer replaces the default card for a pack", () => {
    resetParkRenderers();
    registerParkRenderer("sales", () => "<article data-pack=\"custom-sales\">custom</article>");
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

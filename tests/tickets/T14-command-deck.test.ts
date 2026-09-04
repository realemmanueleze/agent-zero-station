import { describe, expect, it } from "vitest";
import {
  briefForQuery,
  renderActionHomeHtml,
  renderChannelsHtml,
  renderConnectionHtml,
  renderEmailChannelHtml,
} from "../../apps/cockpit/src/ui/command-deck.ts";
import { connectionsFor } from "../../apps/cockpit/src/ui/workspace.ts";
import type { ParkItem } from "../../apps/cockpit/src/ui/types.ts";

const fixture: ParkItem = {
  id: "demo-1",
  state: "parked",
  subject: "Draft quote · $12,400",
  body: "Need a quote for 12 seats. Estimated contract $12400.",
  from: "jordan@northwind.io",
  packId: "sales",
  tenantId: "tenant-a",
  channel: "email",
};

describe("T14 command deck", () => {
  it("action home lists parked items with Approve, Edit, and Kill", () => {
    const html = renderActionHomeHtml([fixture]);
    expect(html).toMatch(/Draft quote/);
    expect(html).toMatch(/Approve|approve/i);
    expect(html).toMatch(/Edit|edit/i);
    expect(html).toMatch(/Kill|kill/i);
  });

  it("channels index lists email, slack, obsidian, db, and mcp", () => {
    const html = renderChannelsHtml();
    expect(html).toMatch(/email/);
    expect(html).toMatch(/slack/);
    expect(html).toMatch(/obsidian/);
    expect(html).toMatch(/db/);
    expect(html).toMatch(/mcp/);
  });

  it("email channel lists more than one mailbox", () => {
    expect(connectionsFor("email").length).toBeGreaterThan(1);
    const html = renderEmailChannelHtml();
    expect(html).toMatch(/work@acme.com/);
    expect(html).toMatch(/hello@acme.com/);
  });

  it("a connection page includes incoming signal text and an action log", () => {
    const html = renderConnectionHtml("email", "work@acme.com", [fixture]);
    expect(html).toMatch(/Need a quote/);
    expect(html).toMatch(/log/);
    expect(html).toMatch(/parked|Draft quote/);
  });

  it("brief query for northwind returns the parked quote", () => {
    const { matches } = briefForQuery([fixture], "northwind");
    expect(matches.items.some((item) => item.id === "demo-1")).toBe(true);
    expect(matches.items[0]?.subject).toMatch(/quote/i);
  });

  it("generated brief mentions waiting / parked work", () => {
    const { brief } = briefForQuery([fixture], "");
    expect(brief).toMatch(/waiting|parked/i);
  });
});

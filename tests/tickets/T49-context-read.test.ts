import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { buildLivePrompt } from "@station/loop";

describe("T49 context read", () => {
  it("inbound, the edit, and the approval share one recordId", async () => {
    const station = getStation({ seed: false });
    await station.kit.parkInbound({
      id: "dec-r",
      tenantId: "tenant-a",
      mailboxId: "box-r",
      threadId: "thread-r",
      body: "Hello lead",
      recordId: "rec-1",
    });
    await station.send.edit("dec-r", "Edited hello");
    expect(await station.kit.linkage("dec-r")).toEqual({
      recordId: "rec-1",
      tenantId: "tenant-a",
    });
    await station.send.approve("dec-r");
    expect(await station.kit.linkage("dec-r")).toMatchObject({ recordId: "rec-1" });
    expect(await station.kit.outbox("dec-r")).toMatchObject({ recordId: "rec-1", state: "sent" });
  });

  it("few-shot context is approved drafts for that record only", async () => {
    const station = getStation({ seed: false });
    await station.kit.parkInbound({
      id: "dec-ours",
      tenantId: "tenant-a",
      mailboxId: "box-ours",
      threadId: "thread-ours",
      body: "ours",
      recordId: "rec-1",
    });
    await station.send.edit("dec-ours", "Approved for rec-1");
    await station.send.approve("dec-ours");
    await station.kit.parkInbound({
      id: "dec-other",
      tenantId: "tenant-a",
      mailboxId: "box-other",
      threadId: "thread-other",
      body: "other",
      recordId: "rec-2",
    });
    await station.send.edit("dec-other", "Approved for rec-2");
    await station.send.approve("dec-other");
    expect(await station.kit.fewShot({ tenantId: "tenant-a", recordId: "rec-1" })).toEqual([
      "Approved for rec-1",
    ]);
  });

  it("another tenant never appears in buildLivePrompt", () => {
    const prompt = buildLivePrompt({
      tenantId: "tenant-a",
      recordId: "rec-1",
      signal: { fixtureId: "a", tenantId: "tenant-a", text: "hello from A" },
      ledgerHits: [
        { tenantId: "tenant-a", text: "inbox for tenant-a" },
        { tenantId: "tenant-b", text: "tenant-b-secret-body" },
      ],
      examples: [
        { tenantId: "tenant-a", recordId: "rec-1", text: "ours-example" },
        { tenantId: "tenant-b", recordId: "rec-1", text: "tenant-b-example-secret" },
        { tenantId: "tenant-a", recordId: "rec-2", text: "other-record-secret" },
      ],
    });
    expect(prompt).toContain("ours-example");
    expect(prompt).toContain("inbox for tenant-a");
    expect(prompt).not.toContain("tenant-b-secret-body");
    expect(prompt).not.toContain("tenant-b-example-secret");
    expect(prompt).not.toContain("other-record-secret");
  });

  it("an empty corpus returns empty and the draft does not invent facts", async () => {
    const station = getStation({ seed: false });
    expect(await station.kit.fewShot({ tenantId: "tenant-a", recordId: "rec-empty" })).toEqual([]);
    const prompt = buildLivePrompt({
      tenantId: "tenant-a",
      recordId: "rec-empty",
      signal: { fixtureId: "e", tenantId: "tenant-a", text: "only this" },
      ledgerHits: [],
      examples: [],
    });
    expect(prompt).toContain("examples=");
    expect(prompt.split("examples=")[1]).toBe("");
    await station.kit.parkInbound({
      id: "dec-empty",
      tenantId: "tenant-a",
      mailboxId: "box-empty",
      threadId: "thread-empty",
      body: "only this",
      recordId: "rec-empty",
    });
    const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
    const slip = (listed.json as { items: Array<{ id: string; body: string }> }).items.find(
      (row) => row.id === "dec-empty",
    );
    expect(slip?.body ?? "").not.toMatch(/Northwind|\$\d|invented/);
  });

  it("has no vector index and no context screen", () => {
    const root = readFileSync("package.json", "utf8");
    const station = readFileSync("packages/station/package.json", "utf8");
    expect(`${root}\n${station}`).not.toMatch(/pgvector|embedding/i);
    expect(readdirSync("apps/cockpit/src/app")).not.toContain("context");
  });
});

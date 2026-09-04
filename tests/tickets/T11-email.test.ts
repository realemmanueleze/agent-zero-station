import { describe, expect, it } from "vitest";
import { StationError, redactFields } from "@station/observability";
import { getStation } from "@station/api";
import {
  commitSend,
  createMemoryTransport,
  gmailHosts,
  mailboxesFromConfig,
} from "@station/channels";
import { stationConfig } from "../../packages/station/src/station-config.ts";

describe("T11 email", () => {
  it("failed commitSend throws send.provider_failed and stays parked", async () => {
    const station = getStation();
    await expect(
      commitSend(
        { to: "jordan@northwind.io", body: "secret quote body" },
        createMemoryTransport({ fail: true }),
      ),
    ).rejects.toMatchObject({ code: "send.provider_failed" });
    expect(await station.send.decisionState("dec-parked")).toBe("parked");
  });

  it("successful transport returns a provider id", async () => {
    const sent: Array<{ to: string; body: string }> = [];
    const receipt = await commitSend(
      { to: "jordan@northwind.io", body: "ok" },
      createMemoryTransport({ sent }),
    );
    expect(receipt.providerId).toMatch(/mem-/);
    expect(sent).toHaveLength(1);
  });

  it("two mailboxes are isolated in prompt buffers", async () => {
    const station = getStation();
    const a = await station.graph.promptBuffer("tenant-a");
    const b = await station.graph.promptBuffer("tenant-b");
    expect(a).not.toContain("tenant-b-secret-body");
    expect(b).not.toContain("inbox for tenant-a");
  });

  it("second email row is config, not channel code", () => {
    const boxes = mailboxesFromConfig(stationConfig);
    expect(boxes.map((row) => row.id)).toEqual(["work@acme.com", "hello@acme.com"]);
    expect(gmailHosts().imap).toBe("imap.gmail.com");
  });

  it("failed send logs redact body and smtp password", () => {
    const redacted = redactFields({
      body: "secret quote body",
      smtpPassword: "smtp-secret",
      to: "jordan@northwind.io",
    });
    const text = JSON.stringify(redacted);
    expect(text).not.toContain("secret quote body");
    expect(text).not.toContain("smtp-secret");
    expect(text).toMatch(/\[REDACTED\]/);
  });

  it("StationError is the only thrown type on provider fail", async () => {
    await expect(
      commitSend({ to: "x", body: "y" }, createMemoryTransport({ fail: true })),
    ).rejects.toBeInstanceOf(StationError);
  });
});

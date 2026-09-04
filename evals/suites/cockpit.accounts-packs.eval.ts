import { describe, expect, it } from "vitest";
import { startStation } from "@station/runtime";

describe("cockpit.accounts-packs (gate: merge)", () => {
  it("accounts lists a mailbox and packs can switch", async () => {
    const runtime = await startStation({ fixturePath: "fixtures/demo.jsonl" });
    try {
      const accounts = await (
        await fetch(`http://127.0.0.1:${runtime.cockpitPort}/accounts`)
      ).text();
      expect(accounts).toMatch(/acme.com/);
      const switched = await fetch(
        `http://127.0.0.1:${runtime.cockpitPort}/packs/inbox-triage/activate`,
        { method: "POST" },
      );
      expect(switched.status).toBe(200);
    } finally {
      await runtime.close();
    }
  });
});

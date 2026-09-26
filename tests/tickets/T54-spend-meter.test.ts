import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StationError } from "@station/observability";
import { noteSpend, observe, spendSentence } from "../../packages/station/src/observer.ts";
import { spendSentence as deskSentence } from "../../apps/cockpit/src/ui/park-action.ts";

describe("T54 spend meter", () => {
  it("observer park or escalate does not send", () => {
    let calls = 0;
    const send = () => {
      calls += 1;
    };
    observe({ action: "park", parkId: "park-a", reason: "review", actor: "observer", send });
    observe({ action: "escalate", parkId: "park-a", reason: "review", actor: "observer", send });
    expect(calls).toBe(0);
  });

  it("escalate is unique on park id and reason", () => {
    const first = observe({
      action: "escalate",
      parkId: "park-b",
      reason: "needs-human",
      actor: "observer",
      send: () => undefined,
    });
    const second = observe({
      action: "escalate",
      parkId: "park-b",
      reason: "needs-human",
      actor: "other",
      send: () => undefined,
    });
    const other = observe({
      action: "escalate",
      parkId: "park-b",
      reason: "other-reason",
      actor: "observer",
      send: () => undefined,
    });
    expect(second.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
  });

  it("spend warns at 50 and 80, a frontier model blocks at 100, and an unknown model fails closed", () => {
    expect(noteSpend({ spent: 50, budget: 100, model: "station" }).warnings).toEqual(["50"]);
    expect(noteSpend({ spent: 80, budget: 100, model: "station" }).warnings).toEqual(["50", "80"]);
    expect(() => noteSpend({ spent: 100, budget: 100, model: "frontier" })).toThrow(StationError);
    expect(() => noteSpend({ spent: 10, budget: 100, model: "mystery-model" })).toThrow(StationError);
    expect(noteSpend({ spent: 100, budget: 100, model: "station" }).blocked).toBe(false);
  });

  it("the desk tick sentence is $42 of $100 and there is no meter component", () => {
    expect(spendSentence(42, 100)).toBe("$42 of $100");
    expect(deskSentence(42, 100)).toBe("$42 of $100");
    expect(existsSync("apps/cockpit/src/ui/Meter.tsx")).toBe(false);
  });

  it("logs redact secrets and mail bodies", () => {
    const lines: string[] = [];
    observe({
      action: "park",
      parkId: "park-log",
      reason: "review",
      actor: "observer",
      send: () => undefined,
      log: lines,
      fields: { api_key: "super-secret-key", body: "secret mail body" },
    });
    const text = lines.join("\n");
    expect(text).not.toContain("super-secret-key");
    expect(text).not.toContain("secret mail body");
    expect(text).toMatch(/\[REDACTED\]/);
  });
});

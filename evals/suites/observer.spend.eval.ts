import { describe, expect, it } from "vitest";
import { observe, spendSentence } from "../../packages/station/src/observer.ts";

describe("observer.spend (gate: merge)", () => {
  it("the observer does not send and the tick shows the spend sentence", () => {
    let calls = 0;
    observe({
      action: "escalate",
      parkId: "eval-park",
      reason: "spend",
      actor: "observer",
      send: () => {
        calls += 1;
      },
    });
    expect(calls).toBe(0);
    expect(spendSentence(42, 100)).toBe("$42 of $100");
  });
});

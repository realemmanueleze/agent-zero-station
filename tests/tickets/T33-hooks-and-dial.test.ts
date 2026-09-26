import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StationError } from "@station/observability";
import { getPack } from "@station/packs";
import { LIVE_TOOL_NAMES, runLiveTurn, runScoringTurn, scoringTurnCallsCommitSend } from "@station/loop";
import { writeProposal } from "../../packages/station/src/learning.ts";
import {
  applyDial,
  bootHolds,
  holdForJustDo,
  killHold,
  readDial,
  recheckHold,
  setDial,
  snapshotHolds,
  toolMayChangeDial,
} from "../../packages/station/src/dial.ts";

const signal = { text: "Need a consult", from: "jordan@northwind.io", subject: "Intro" };

describe("T33 hooks and dial", () => {
  it("the live tool table still cannot send", () => {
    expect(LIVE_TOOL_NAMES).toHaveLength(7);
    expect(LIVE_TOOL_NAMES).not.toContain("commit_send");
    expect(scoringTurnCallsCommitSend()).toBe(false);
    const loop = readFileSync("packages/loop/package.json", "utf8");
    expect(loop).not.toMatch(/deepagents/);
  });

  it("a turn without a model key matches the scoring turn", () => {
    const scored = runScoringTurn("sales", signal);
    const live = runLiveTurn("sales", signal);
    expect(live.packId).toBe(scored.packId);
    expect(live.state).toBe(scored.state);
    expect(live.body).toBe(scored.body);
    expect(live.tools).toEqual(scored.tools);
  });

  it("an unknown pack is pack.unknown and does not become sales", () => {
    expect(() => getPack("no-such-pack")).toThrow(StationError);
    expect(() => getPack("no-such-pack")).toThrow(
      expect.objectContaining({ code: "pack.unknown", status: 400 }),
    );
  });

  it("pack-unseen-engine drafts without calling transport", () => {
    const pack = getPack("pack-unseen-engine");
    const body = pack.draft(signal, pack.score(signal));
    expect(typeof body).toBe("string");
    expect(body.length).toBeGreaterThan(0);
    expect(pack.beforePark(body, signal)).toBe("park");
    expect(pack.draft.toString()).not.toMatch(/approveWithConnection|commit_send|fetch\(/);
  });

  it("the dial parks, holds, or denies, and tools cannot change it", () => {
    setDial("ask_me");
    expect(applyDial("h-ask")).toBe("parked");
    setDial("just_do");
    expect(applyDial("h-do")).toBe("held");
    expect(recheckHold("h-do")).toBe("held");
    setDial("never");
    expect(() => applyDial("h-never")).toThrow(
      expect.objectContaining({ code: "policy.denied" }),
    );
    const before = readDial();
    expect(toolMayChangeDial("set_dial")).toBe(false);
    expect(readDial()).toBe(before);
    writeProposal({ packId: "sales", date: "2026-09-26", outcomes: [], root: "/tmp/station-t33-learning" });
    expect(readDial()).toBe(before);
  });

  it("a hold stays held across a restart until Kill", () => {
    setDial("just_do");
    holdForJustDo("h-restart");
    const saved = snapshotHolds();
    bootHolds(saved);
    expect(recheckHold("h-restart")).toBe("held");
    killHold("h-restart");
    expect(recheckHold("h-restart")).toBe("cancelled");
  });
});

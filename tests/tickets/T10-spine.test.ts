import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StationError } from "@station/observability";
import { getStation } from "@station/api";
import { getPack } from "@station/packs";
import { runScoringTurn, scoringTurnCallsCommitSend } from "@station/loop";

describe("T10 spine", () => {
  it("ledger SQL creates signals, claims, leases, decisions, and da_ tables", () => {
    const sql = readFileSync(join(process.cwd(), "migrations/001_ledger.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS signals/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS claims/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS leases/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS decisions/);
    expect(sql).toMatch(/da_checkpoints/);
  });

  it("migrate-fail still throws schema.migrate_failed", async () => {
    const broken = getStation({ seed: false });
    broken.config.load({
      STATION_DATABASE_URL: "postgres://migrate-fail/db",
      STATION_MASTER_KEY: "test-master-key-for-local-suites",
    });
    await expect(broken.schema.migrate()).rejects.toBeInstanceOf(StationError);
    await expect(broken.schema.migrate()).rejects.toMatchObject({
      code: "schema.migrate_failed",
    });
  });

  it("sales and inbox-triage drafts are pure and different", () => {
    const signal = { text: "Need a quote", from: "jordan@northwind.io", amount: 12400 };
    const sales = getPack("sales");
    const triage = getPack("inbox-triage");
    expect(sales.draft(signal, sales.score(signal))).toBe(
      sales.draft(signal, sales.score(signal)),
    );
    expect(sales.draft(signal, sales.score(signal))).not.toBe(
      triage.draft(signal, triage.score(signal)),
    );
  });

  it("sales.beforePark rewrites a 50% discount to 5%", () => {
    expect(getPack("sales").beforePark("Offer 50% off", { text: "Offer 50% off" })).toBe(
      "park",
    );
    const turn = runScoringTurn("sales", { text: "Can you do 50%?" });
    expect(turn.body).toMatch(/5%/);
    expect(turn.body).not.toMatch(/50%/);
  });

  it("runScoringTurn never exposes commit_send", () => {
    const turn = runScoringTurn("sales", {
      text: "Need a quote for $12400",
      amount: 12400,
    });
    expect(["parked", "dropped", "escalated"]).toContain(turn.state);
    expect(turn.tools).not.toContain("commit_send");
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

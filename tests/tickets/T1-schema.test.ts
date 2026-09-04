import { describe, expect, it } from "vitest";
import { StationError } from "@station/observability";
import { getStation } from "@station/api";

const station = getStation();

describe("T1 schema", () => {
  it("migrating twice is idempotent", async () => {
    await station.schema.migrate();
    await expect(station.schema.migrateAgain()).resolves.toBeUndefined();
  });

  it("same fixtureId upserts and row count stays 1", async () => {
    await station.schema.upsertSignal({ fixtureId: "demo-1" });
    await station.schema.upsertSignal({ fixtureId: "demo-1" });
    expect(await station.schema.countSignals()).toBe(1);
  });

  it("two claims on the same signalId and packId: one wins, one is claim.taken", async () => {
    const first = station.schema.claim("sig-1", "sales", "w1");
    const second = station.schema.claim("sig-1", "sales", "w2");
    const results = await Promise.allSettled([first, second]);
    const rejected = results.filter((row) => row.status === "rejected");
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(StationError);
    expect(err).toMatchObject({ code: "claim.taken" });
  });

  it("lease insert for a live holder returns lease.held", async () => {
    await station.schema.acquireLease("gmail:acct-1", "w1");
    await expect(station.schema.acquireLease("gmail:acct-1", "w2")).rejects.toMatchObject({
      code: "lease.held",
    });
  });

  it("expired lease older than 30s can be taken by a second worker", async () => {
    await station.schema.acquireLease("gmail:acct-2", "w1");
    await station.schema.expireLease("gmail:acct-2");
    await expect(station.schema.acquireLease("gmail:acct-2", "w2")).resolves.toBeUndefined();
  });

  it("second decision insert with the same sendId fails", async () => {
    await station.schema.insertDecision({ sendId: "send-1" });
    await expect(station.schema.insertDecision({ sendId: "send-1" })).rejects.toBeTruthy();
  });

  it("parked to sending succeeds once; second CAS affects 0 rows", async () => {
    const first = await station.schema.transition("dec-1", "parked", "sending");
    const second = await station.schema.transition("dec-1", "parked", "sending");
    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("checkpointer tables share STATION_DATABASE_URL and use a da_ prefix", async () => {
    const checkpointer = await station.schema.checkpointerTableNames();
    const ledger = await station.schema.ledgerTableNames();
    expect(checkpointer.every((name) => name.startsWith("da_"))).toBe(true);
    expect(checkpointer.some((name) => ledger.includes(name))).toBe(false);
  });

  it("pack SQL pointed at STATION_DATABASE_URL is config.pack_db_same_as_station", () => {
    expect(() =>
      station.config.load({
        STATION_DATABASE_URL: "postgres://station/db",
        PACK_DATABASE_URL: "postgres://station/db",
      }),
    ).toThrow(
      expect.objectContaining({ code: "config.pack_db_same_as_station" }),
    );
  });

  it("migration failure throws schema.migrate_failed, not a raw driver error", async () => {
    const broken = getStation();
    broken.config.load({
      STATION_DATABASE_URL: "postgres://migrate-fail/db",
      STATION_MASTER_KEY: "test-master-key-for-local-suites",
    });
    await expect(broken.schema.migrate()).rejects.toMatchObject({
      code: "schema.migrate_failed",
    });
  });
});

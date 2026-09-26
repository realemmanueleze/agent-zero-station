import { describe, expect, it } from "vitest";
import { daCheckpointQuery } from "../../packages/station/src/persist-sql.ts";
import { createStationRail } from "../../packages/station/src/rail-host.ts";
import { RailEngine, type RailStore } from "../../packages/loop/src/rail.ts";

function store(): RailStore {
  return { checkpoints: [], opens: new Map() };
}

const inbound = {
  mailboxId: "work@unseen.test",
  threadId: "thread-1",
  thread: "Can we book a consult?",
  from: "jordan@northwind.io",
  subject: "Consult",
};

describe("T41 rail checkpoint", () => {
  it("pauses an inbound email before send and records the graph nodes", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      store: store(),
      send: (state) => sends.push(state.draft),
    });
    const parked = await rail.start({ runId: "run-1", ...inbound });
    expect(parked.phase).toBe("human_review");
    expect(parked.draft.length).toBeGreaterThan(0);
    expect(parked.from).toBe("jordan@northwind.io");
    expect(parked.subject).toBe("Consult");
    expect(parked.trace).toContain("enrich_lead");
    expect(parked.trace).toContain("draft_outreach");
    expect(parked.trace).not.toContain("send_email");
    expect(sends).toEqual([]);
    expect(rail.checkpointer.constructor.name).toBe("LedgerCheckpointer");
  });

  it("writes da_checkpoints and a new engine stays paused on the same run", async () => {
    const shared = store();
    const first = new RailEngine({ store: shared, send: () => undefined });
    await first.start({ runId: "run-keep", ...inbound });
    const row = shared.checkpoints.find((item) => item.id === "run-keep");
    expect(row?.checkpoint).toBeTruthy();
    const query = daCheckpointQuery(row!);
    expect(query.text).toMatch(/INSERT INTO da_checkpoints/);
    expect(query.values[0]).toBe("run-keep");

    const revived: RailStore = {
      checkpoints: JSON.parse(JSON.stringify(shared.checkpoints)),
      opens: new Map(JSON.parse(JSON.stringify([...shared.opens]))),
    };
    const second = new RailEngine({ store: revived, send: () => undefined });
    const again = await second.start({ runId: "run-other", ...inbound });
    expect(again.runId).toBe("run-keep");
    expect(again.phase).toBe("human_review");
  });

  it("the worker rail uses the ledger checkpointer", () => {
    const rail = createStationRail();
    expect(rail.checkpointer.constructor.name).toBe("LedgerCheckpointer");
  });
});

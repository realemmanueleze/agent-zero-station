import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

type Slip = {
  id: string;
  state: string;
  phase?: string | null;
  trace?: string[];
  goalStage?: string | null;
  runId?: string | null;
};

async function sentReply(id: string, reply: string) {
  const station = getStation({ seed: false });
  const parked = await station.kit.parkInbound({
    id,
    tenantId: "tenant-a",
    mailboxId: "box-t45",
    threadId: `thread-${id}`,
    body: "Intro is out.",
  });
  await station.send.approve(parked.decisionId);
  const next = await station.kit.resumeReply({
    mailboxId: "box-t45",
    threadId: `thread-${id}`,
    body: reply,
  });
  const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
  const slip = (listed.json as { items: Slip[] }).items.find((item) => item.id === next.decisionId);
  return { station, parked, next, slip };
}

describe("T45 rail branches", () => {
  it("triage sets the goal stage on a booked reply and does not send", async () => {
    const { station, parked, slip } = await sentReply("t45-booked", "We booked Thursday.");
    expect(slip).toMatchObject({ state: "parked", phase: "human_review", goalStage: "booked" });
    expect(slip?.trace).toEqual(
      expect.arrayContaining(["triage_reply", "update_goal_stage", "process_transcript", "next_best_actions"]),
    );
    expect(await station.kit.outbox(slip?.id ?? "")).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("an objection parks an objection draft and does not send", async () => {
    const { station, parked, slip } = await sentReply("t45-objection", "Too expensive for us.");
    expect(slip).toMatchObject({ state: "parked", phase: "human_review", goalStage: "objection" });
    expect(slip?.trace).toContain("draft_objection");
    expect(slip?.trace).not.toContain("process_transcript");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });

  it("any other reply parks the next draft on the same run", async () => {
    const { station, parked, next, slip } = await sentReply("t45-other", "Can we talk next week?");
    expect(next.runId).toBe(parked.runId);
    expect(slip).toMatchObject({ state: "parked", phase: "human_review", goalStage: "reply" });
    expect(slip?.trace).toContain("draft_response");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });
});

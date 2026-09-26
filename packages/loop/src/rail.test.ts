import { describe, expect, it } from "vitest";
import { RailEngine } from "./rail.ts";

describe("rail engine", () => {
  it("pauses for review and does not send until Approve", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      send: (state) => {
        sends.push(state.draft);
      },
    });
    const parked = await rail.start({
      runId: "run-1",
      mailboxId: "work@unseen.test",
      threadId: "thread-1",
      thread: "Jordan asked for a consult.",
    });
    expect(parked.phase).toBe("human_review");
    expect(parked.draft.length).toBeGreaterThan(0);
    expect(sends).toEqual([]);

    const waiting = await rail.resume("run-1", { action: "approve" });
    expect(waiting.phase).toBe("wait_for_reply");
    expect(sends).toEqual([parked.draft]);
    expect(waiting.sentCount).toBe(1);
  });

  it("a second Approve while waiting does not send again", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      send: (state) => {
        sends.push(state.draft);
      },
    });
    await rail.start({
      runId: "run-replay",
      mailboxId: "work@unseen.test",
      threadId: "thread-replay",
      thread: "Need a time.",
    });
    await rail.resume("run-replay", { action: "approve" });
    const still = await rail.resume("run-replay", { action: "approve" });
    expect(still.phase).toBe("wait_for_reply");
    expect(still.sentCount).toBe(1);
    expect(sends).toHaveLength(1);
  });

  it("Kill before send leaves the provider uncalled", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      send: () => {
        sends.push("nope");
      },
    });
    await rail.start({
      runId: "run-kill",
      mailboxId: "work@unseen.test",
      threadId: "thread-kill",
      thread: "Hello",
    });
    const done = await rail.resume("run-kill", { action: "kill" });
    expect(done.phase).toBe("done");
    expect(sends).toEqual([]);
  });

  it("an edit replaces the draft and still does not send", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      send: (state) => {
        sends.push(state.draft);
      },
    });
    await rail.start({
      runId: "run-edit",
      mailboxId: "work@unseen.test",
      threadId: "thread-edit",
      thread: "Quote?",
    });
    const edited = await rail.resume("run-edit", { action: "edit", body: "Edited consult note." });
    expect(edited.phase).toBe("human_review");
    expect(edited.draft).toBe("Edited consult note.");
    expect(sends).toEqual([]);
  });

  it("a reply resumes the same run and parks the next draft", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      send: (state) => {
        sends.push(state.draft);
      },
    });
    await rail.start({
      runId: "run-reply",
      mailboxId: "work@unseen.test",
      threadId: "thread-reply",
      thread: "Can we book Thursday?",
    });
    await rail.resume("run-reply", { action: "approve" });
    const next = await rail.resume("run-reply", { kind: "reply", text: "Thursday works." });
    expect(next.phase).toBe("human_review");
    expect(next.runId).toBe("run-reply");
    expect(next.draft).toContain("Thursday works.");
    expect(sends).toHaveLength(1);
  });
});

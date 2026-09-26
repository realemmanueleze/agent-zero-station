import { describe, expect, it } from "vitest";
import { LIVE_TOOL_NAMES, RailEngine } from "@station/loop";
import { guardToolCall, draftWithAgent, drafterToolNames, fakeDraftModel } from "../../packages/loop/src/drafter.ts";

const DENIED = ["ls", "read_file", "write_file", "edit_file", "glob", "grep", "execute", "task", "commit_send"];

describe("T46 deep agent draft", () => {
  it("the drafter tools are the seven live tools and cannot send", () => {
    expect(drafterToolNames()).toEqual([...LIVE_TOOL_NAMES]);
    for (const name of DENIED) {
      expect(drafterToolNames()).not.toContain(name);
    }
    const sends: string[] = [];
    expect(guardToolCall("escalate", () => sends.push("escalate"))).toBe("denied");
    expect(guardToolCall("commit_send", () => sends.push("commit"))).toBe("denied");
    expect(guardToolCall("approveWithConnection", () => sends.push("approve"))).toBe("denied");
    expect(sends).toEqual([]);
  });

  it("createDeepAgent drafts only inside the three draft nodes", async () => {
    const calls: string[] = [];
    const rail = new RailEngine({
      send: () => undefined,
      draft: async (node) => {
        calls.push(node);
        return `drafted by ${node}`;
      },
    });
    const parked = await rail.start({
      runId: "t46-nodes",
      mailboxId: "box-t46",
      threadId: "thread-t46-nodes",
      thread: "Need a consult.",
    });
    expect(parked.phase).toBe("human_review");
    expect(parked.draft).toBe("drafted by draft_outreach");
    expect(calls).toEqual(["draft_outreach"]);

    await rail.resume("t46-nodes", { action: "approve" });
    const replied = await rail.resume("t46-nodes", { kind: "reply", text: "Tuesday works." });
    expect(replied.draft).toContain("drafted by draft_response");
    expect(calls).toContain("draft_response");

    const booked = new RailEngine({
      send: () => undefined,
      draft: async (node) => {
        calls.push(node);
        return `drafted by ${node}`;
      },
    });
    await booked.start({
      runId: "t46-booked",
      mailboxId: "box-t46",
      threadId: "thread-t46-booked",
      thread: "Need a consult.",
    });
    await booked.resume("t46-booked", { action: "approve" });
    const next = await booked.resume("t46-booked", { kind: "reply", text: "We booked Thursday." });
    expect(next.draft).toContain("drafted by next_best_actions");
    expect(calls).not.toContain("send_email");
    expect(calls).not.toContain("enrich_lead");
  });

  it("boots createDeepAgent on a fake model and does not send", async () => {
    const text = await draftWithAgent({
      node: "draft_outreach",
      text: "Need a consult.",
      model: fakeDraftModel(),
    });
    expect(text).toContain("FAKE DRAFT");
  });

  it("no model key keeps the pack draft and still pauses", async () => {
    const rail = new RailEngine({ send: () => undefined });
    const parked = await rail.start({
      runId: "t46-pack",
      mailboxId: "box-t46",
      threadId: "thread-t46-pack",
      thread: "Need a consult.",
      from: "jordan@northwind.io",
      subject: "Consult",
    });
    expect(parked.phase).toBe("human_review");
    expect(parked.draft).toContain("unseen consult");
  });
});

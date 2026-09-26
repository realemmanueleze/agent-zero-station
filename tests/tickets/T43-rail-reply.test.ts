import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

type Slip = {
  id: string;
  state: string;
  phase?: string | null;
  trace?: string[];
  body?: string;
  runId?: string | null;
};

async function desk() {
  const station = getStation({ seed: false });
  const bound = await station.worker.listen({ host: "127.0.0.1", token: "t43" });
  const headers = { authorization: "Bearer t43", "content-type": "application/json" };
  const call = (path: string, method = "GET", body?: string) =>
    station.worker.request({
      host: "127.0.0.1",
      port: bound.port,
      path,
      method,
      headers,
      body,
    });
  const slips = async () => {
    const listed = await call("/park");
    return (listed.json as { items: Slip[] }).items;
  };
  return { station, bound, call, slips };
}

describe("T43 rail reply", () => {
  it("a reply resumes the same run and parks the next draft", async () => {
    const { station, bound, slips } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t43-reply",
      tenantId: "tenant-a",
      mailboxId: "box-t43",
      threadId: "thread-t43-reply",
      body: "Can we book a consult?",
    });
    await station.send.approve(parked.decisionId);
    const next = await station.kit.resumeReply({
      mailboxId: "box-t43",
      threadId: "thread-t43-reply",
      body: "Tuesday works.",
    });
    expect(next.runId).toBe(parked.runId);
    const slip = (await slips()).find((item) => item.id === next.decisionId);
    expect(slip).toMatchObject({ state: "parked", phase: "human_review" });
    expect(slip?.body).toContain("Tuesday works.");
    expect(slip?.trace).toContain("draft_response");
    expect(await station.kit.outbox(next.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    await bound.close();
  });

  it("a form with no open wait starts one run and does not send", async () => {
    const { station, bound, call, slips } = await desk();
    const posted = await call(
      "/form",
      "POST",
      JSON.stringify({
        tenantId: "tenant-a",
        mailboxId: "box-t43",
        threadId: "thread-t43-form",
        body: "New lead from the site.",
      }),
    );
    expect(posted.status).toBe(200);
    const started = posted.json as { runId: string; decisionId: string };
    const again = await call(
      "/form",
      "POST",
      JSON.stringify({
        tenantId: "tenant-a",
        mailboxId: "box-t43",
        threadId: "thread-t43-form",
        body: "New lead from the site.",
      }),
    );
    const second = again.json as { runId: string };
    expect(second.runId).toBe(started.runId);
    const slip = (await slips()).find((item) => item.id === started.decisionId);
    expect(slip).toMatchObject({ state: "parked", phase: "human_review" });
    expect(slip?.trace).toContain("enrich_lead");
    expect(slip?.trace).not.toContain("send_email");
    expect(await station.send.providerCallCount(`send-${started.decisionId}`)).toBe(0);
    await bound.close();
  });

  it("a form with an open reply wait resumes that run", async () => {
    const { station, bound, call } = await desk();
    const parked = await station.kit.parkInbound({
      id: "t43-form-resume",
      tenantId: "tenant-a",
      mailboxId: "box-t43",
      threadId: "thread-t43-form-resume",
      body: "Waiting on them.",
    });
    await station.send.approve(parked.decisionId);
    const posted = await call(
      "/form",
      "POST",
      JSON.stringify({
        tenantId: "tenant-a",
        mailboxId: "box-t43",
        threadId: "thread-t43-form-resume",
        body: "We booked it.",
      }),
    );
    expect(posted.status).toBe(200);
    const resumed = posted.json as { runId: string; decisionId: string };
    expect(resumed.runId).toBe(parked.runId);
    expect(resumed.decisionId).not.toBe(parked.decisionId);
    expect(await station.send.decisionState(resumed.decisionId)).toBe("parked");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    await bound.close();
  });

  it("mail bodies stay out of the request log", async () => {
    const { bound, call } = await desk();
    const posted = await call(
      "/form",
      "POST",
      JSON.stringify({
        tenantId: "tenant-a",
        mailboxId: "box-t43",
        threadId: "thread-t43-log",
        body: "secret-reply-body-t43",
      }),
    );
    expect(posted.status).toBe(200);
    expect(posted.logs.join("\n")).not.toContain("secret-reply-body-t43");
    await bound.close();
  });
});

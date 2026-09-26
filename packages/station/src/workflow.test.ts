import { describe, expect, it, vi } from "vitest";
import { WorkflowDesk, needsAction, parseChat } from "./workflow.ts";

const mailbox = {
  account: "founder@gmail.com",
  refreshToken: "refresh",
  accessToken: "access",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

function message(from: string, subject: string, text: string) {
  return {
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: from },
        { name: "Subject", value: subject },
      ],
      body: { data: Buffer.from(text).toString("base64url") },
    },
  };
}

function gmailFetch(webhookPosts: string[]): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("gmail.googleapis.com") && url.includes("/messages?")) {
      return new Response(
        JSON.stringify({
          messages: [
            { id: "m-ask", threadId: "t-ask" },
            { id: "m-sent", threadId: "t-ask" },
            { id: "m-news", threadId: "t-news" },
          ],
        }),
      );
    }
    if (url.includes("/threads/t-ask")) {
      return new Response(
        JSON.stringify({
          id: "t-ask",
          messages: [
            message("jordan@northwind.io", "Quote", "Can you approve the quote?"),
            message("founder@gmail.com", "Re: Quote", "Following up on the seats."),
          ],
        }),
      );
    }
    if (url.includes("/threads/t-news")) {
      return new Response(
        JSON.stringify({
          id: "t-news",
          messages: [message("news@vendor.io", "Weekly", "Unsubscribe from this newsletter")],
        }),
      );
    }
    webhookPosts.push(String(init?.body ?? ""));
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
}

describe("workflow proof", () => {
  it("chat names the window and the webhook", () => {
    expect(parseChat("scan mail from the last 3 days and webhook https://hooks.example/mail")).toEqual({
      days: 3,
      webhookUrl: "https://hooks.example/mail",
    });
    expect(parseChat("hello")).toBeNull();
  });

  it("a question needs a person and a newsletter does not", () => {
    expect(needsAction("Quote", "Can you approve the quote?")).toBe("asks for a reply or a decision");
    expect(needsAction("Weekly", "Unsubscribe from this newsletter")).toBeNull();
  });

  it("a chat run reads mail, parks the ask, and posts the webhook once", async () => {
    const posts: string[] = [];
    const desk = new WorkflowDesk();
    const run = await desk.runChat("analyze email from the last 3 days https://hooks.example/mail", {
      mailboxes: [mailbox],
      fetchImpl: gmailFetch(posts),
      env: { GOOGLE_OAUTH_CLIENT_ID: "cid", GOOGLE_OAUTH_CLIENT_SECRET: "sec" },
    });
    expect(run.scanned).toBe(3);
    expect(run.needsAction).toHaveLength(1);
    const hit = run.needsAction[0];
    expect(hit?.from).toBe("jordan@northwind.io");
    expect(hit?.subject).toBe("Quote");
    expect(hit?.thread).toMatch(/Can you approve the quote/);
    expect(hit?.thread).toMatch(/Following up on the seats/);
    expect(hit?.draft).toMatch(/Quote/);
    expect(hit?.draft).toMatch(/Following up on the seats/);
    expect(posts).toHaveLength(1);
    const body = JSON.parse(posts[0] ?? "{}") as { needsAction: Array<{ subject: string }>; snippet?: string };
    expect(body.needsAction[0]?.subject).toBe("Quote");
    expect(JSON.stringify(body)).not.toMatch(/approve the quote/i);
    expect(run.webhookStatus).toBe(200);
  });

  it("a due schedule runs and a later tick does not repeat it", async () => {
    const posts: string[] = [];
    const desk = new WorkflowDesk();
    desk.define({
      id: "daily",
      name: "Morning mail",
      days: 3,
      webhookUrl: "https://hooks.example/mail",
      everyMs: 60_000,
    });
    const first = await desk.tick(1_000, {
      mailboxes: [mailbox],
      fetchImpl: gmailFetch(posts),
      env: { GOOGLE_OAUTH_CLIENT_ID: "cid", GOOGLE_OAUTH_CLIENT_SECRET: "sec" },
    });
    const second = await desk.tick(2_000, {
      mailboxes: [mailbox],
      fetchImpl: gmailFetch(posts),
      env: {},
    });
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(posts).toHaveLength(1);
  });
});

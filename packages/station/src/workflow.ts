import { StationError } from "@station/observability";

export type GmailMailbox = {
  account: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: string;
};

export type WorkflowDef = {
  id: string;
  name: string;
  days: number;
  webhookUrl: string;
  everyMs: number | null;
};

export type MailHit = {
  account: string;
  from: string;
  subject: string;
  reason: string;
  threadId: string;
  thread: string;
  draft: string;
};

export type WorkflowRun = {
  workflowId: string;
  name: string;
  scanned: number;
  needsAction: MailHit[];
  webhookStatus: number | null;
};

type RunDeps = {
  mailboxes: GmailMailbox[];
  fetchImpl: typeof fetch;
  env: Record<string, string | undefined>;
};

type ThreadMessage = {
  from: string;
  subject: string;
  text: string;
};

type MailThread = {
  id: string;
  subject: string;
  from: string;
  messages: ThreadMessage[];
};

export function parseChat(text: string): { days: number; webhookUrl: string } | null {
  if (!/\b(mail|email|inbox)\b/i.test(text)) {
    return null;
  }
  const days = Number(text.match(/(\d+)\s*day/i)?.[1] ?? 3);
  const webhookUrl = text.match(/https?:\/\/\S+/)?.[0] ?? "";
  return { days: Number.isFinite(days) && days > 0 ? days : 3, webhookUrl };
}

export function needsAction(subject: string, snippet: string): string | null {
  const text = `${subject} ${snippet}`;
  if (/\b(unsubscribe|newsletter|noreply|no-reply)\b/i.test(text)) {
    return null;
  }
  if (/\?/.test(text) || /\b(please|need|urgent|invoice|approve|deadline|action required|can you)\b/i.test(text)) {
    return "asks for a reply or a decision";
  }
  return null;
}

function headerOf(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  return headers?.find((row) => row.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function accessTokenFor(box: GmailMailbox, deps: RunDeps): Promise<string> {
  if (box.accessToken && Date.parse(box.expiresAt) > Date.now() + 60_000) {
    return box.accessToken;
  }
  const res = await deps.fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: deps.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: deps.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: box.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new StationError({
      code: "connections.needs_reauth",
      message: "google refresh failed",
    });
  }
  return json.access_token;
}

function decodeBody(data: string | undefined): string {
  if (!data) {
    return "";
  }
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function plainText(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
} | undefined): string {
  if (!payload) {
    return "";
  }
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = plainText(part as Parameters<typeof plainText>[0]);
    if (text) {
      return text;
    }
  }
  return decodeBody(payload.body?.data);
}

export function draftReply(input: { account: string; subject: string; messages: ThreadMessage[] }): string {
  const theirs = [...input.messages].reverse().find((row) => !row.from.toLowerCase().includes(input.account.toLowerCase()));
  const ours = [...input.messages].reverse().find((row) => row.from.toLowerCase().includes(input.account.toLowerCase()));
  const ask = theirs?.text.trim() || input.subject;
  const prior = ours ? ` I already wrote: “${ours.text.trim()}”.` : "";
  const name = (theirs?.from ?? "there").split("@")[0]?.split("<").pop()?.trim() || "there";
  return `Hi ${name},\n\nI read the thread on ${input.subject}.${prior}\n\nOn “${ask}”: I will answer this directly. Edit this draft before Approve sends it.\n`;
}

async function readWindow(box: GmailMailbox, days: number, deps: RunDeps): Promise<MailThread[]> {
  const token = await accessTokenFor(box, deps);
  const listed = await deps.fetchImpl(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`newer_than:${days}d`)}&maxResults=15`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!listed.ok) {
    throw new StationError({
      code: "connections.invalid",
      message: "gmail list failed",
    });
  }
  const json = (await listed.json()) as { messages?: Array<{ id?: string; threadId?: string }> };
  const threadIds = [...new Set((json.messages ?? []).map((row) => row.threadId).filter((id): id is string => Boolean(id)))];
  const threads: MailThread[] = [];
  for (const threadId of threadIds) {
    const got = await deps.fetchImpl(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!got.ok) {
      continue;
    }
    const thread = (await got.json()) as {
      messages?: Array<{ payload?: { headers?: Array<{ name?: string; value?: string }>; mimeType?: string; body?: { data?: string }; parts?: [] } }>;
    };
    const messages: ThreadMessage[] = [];
    for (const message of thread.messages ?? []) {
      messages.push({
        from: headerOf(message.payload?.headers, "From") || "unknown",
        subject: headerOf(message.payload?.headers, "Subject") || "(no subject)",
        text: plainText(message.payload),
      });
    }
    if (messages.length === 0) {
      continue;
    }
    const first = messages[0];
    threads.push({
      id: threadId,
      subject: first?.subject.replace(/^Re:\s*/i, "") || "(no subject)",
      from: messages.find((row) => !row.from.toLowerCase().includes(box.account.toLowerCase()))?.from ?? first?.from ?? "unknown",
      messages,
    });
  }
  return threads;
}

async function postWebhook(url: string, run: WorkflowRun, fetchImpl: typeof fetch): Promise<number> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workflowId: run.workflowId,
      name: run.name,
      scanned: run.scanned,
      needsAction: run.needsAction.map((hit) => ({
        account: hit.account,
        from: hit.from,
        subject: hit.subject,
        reason: hit.reason,
      })),
    }),
  });
  return res.status;
}

export class WorkflowDesk {
  private readonly defs = new Map<string, WorkflowDef>();
  private readonly nextAt = new Map<string, number>();
  private lastRun: WorkflowRun | null = null;

  define(def: WorkflowDef): WorkflowDef {
    this.defs.set(def.id, def);
    if (def.everyMs && !this.nextAt.has(def.id)) {
      this.nextAt.set(def.id, 0);
    }
    return def;
  }

  list(): WorkflowDef[] {
    return [...this.defs.values()];
  }

  latest(): WorkflowRun | null {
    return this.lastRun;
  }

  async runChat(text: string, deps: RunDeps): Promise<WorkflowRun> {
    const parsed = parseChat(text);
    if (!parsed) {
      throw new StationError({
        code: "connections.invalid",
        message: "say scan mail, a day window, and a webhook url",
      });
    }
    const def = this.define({
      id: "chat",
      name: "Chat",
      days: parsed.days,
      webhookUrl: parsed.webhookUrl,
      everyMs: null,
    });
    return this.execute(def, deps);
  }

  async tick(now: number, deps: RunDeps): Promise<WorkflowRun[]> {
    const runs: WorkflowRun[] = [];
    for (const def of this.defs.values()) {
      if (!def.everyMs) {
        continue;
      }
      const due = this.nextAt.get(def.id) ?? 0;
      if (now < due) {
        continue;
      }
      runs.push(await this.execute(def, deps));
      this.nextAt.set(def.id, now + def.everyMs);
    }
    return runs;
  }

  private async execute(def: WorkflowDef, deps: RunDeps): Promise<WorkflowRun> {
    const needs: MailHit[] = [];
    let scanned = 0;
    for (const box of deps.mailboxes) {
      const threads = await readWindow(box, def.days, deps);
      for (const thread of threads) {
        scanned += thread.messages.length;
        const transcript = thread.messages.map((row) => `${row.from}: ${row.text}`).join("\n");
        const reason = needsAction(thread.subject, transcript);
        if (!reason) {
          continue;
        }
        needs.push({
          account: box.account,
          from: thread.from,
          subject: thread.subject,
          reason,
          threadId: thread.id,
          thread: transcript,
          draft: draftReply({ account: box.account, subject: thread.subject, messages: thread.messages }),
        });
      }
    }
    const run: WorkflowRun = {
      workflowId: def.id,
      name: def.name,
      scanned,
      needsAction: needs,
      webhookStatus: null,
    };
    if (def.webhookUrl) {
      run.webhookStatus = await postWebhook(def.webhookUrl, run, deps.fetchImpl);
    }
    this.lastRun = run;
    return run;
  }
}

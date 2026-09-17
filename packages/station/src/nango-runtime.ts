import { StationError } from "@station/observability";
import type { ProducedEmail } from "./email-producer.ts";
import { nangoHost, type NangoFetch } from "./nango.ts";

export type { NangoFetch };

export type NangoEnvelope = {
  provider: "nango";
  connectionId: string;
  integration: string;
};

export type NangoKind = "email" | "slack";

type ProxyInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export function parseNangoEnvelope(fields: Record<string, unknown>): NangoEnvelope | undefined {
  if (fields.provider !== "nango") {
    return undefined;
  }
  const connectionId = String(fields.connectionId ?? "");
  const integration = String(fields.integration ?? "");
  if (!connectionId || !integration) {
    return undefined;
  }
  return { provider: "nango", connectionId, integration };
}

function secretOf(env: Record<string, string | undefined>): string {
  const secret = env.NANGO_SECRET_KEY ?? "";
  if (!secret) {
    throw new StationError({
      code: "connections.invalid",
      message: "NANGO_SECRET_KEY is required",
    });
  }
  return secret;
}

export function nangoProxyHeaders(
  env: Record<string, string | undefined>,
  envelope: NangoEnvelope,
): Record<string, string> {
  return {
    authorization: `Bearer ${secretOf(env)}`,
    "connection-id": envelope.connectionId,
    "provider-config-key": envelope.integration,
  };
}

export async function nangoDefaultFetch(
  url: string,
  init?: ProxyInit,
): Promise<{ status: number; json: () => Promise<unknown> }> {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json() as Promise<unknown> };
}

async function nangoProxy(input: {
  env: Record<string, string | undefined>;
  envelope: NangoEnvelope;
  path: string;
  method?: string;
  body?: string;
  fetchImpl?: NangoFetch;
}): Promise<{ status: number; json: () => Promise<unknown> }> {
  const fetchImpl = input.fetchImpl ?? nangoDefaultFetch;
  const url = `${nangoHost(input.env)}/proxy${input.path}`;
  return fetchImpl(url, {
    method: input.method ?? "GET",
    headers: {
      ...nangoProxyHeaders(input.env, input.envelope),
      ...(input.body ? { "content-type": "application/json" } : {}),
    },
    body: input.body,
  });
}

function decodeGmailBody(raw: string | undefined): string {
  if (!raw) {
    return "";
  }
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function headerOf(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  return headers?.find((row) => row.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function pollGmail(input: {
  account: string;
  envelope: NangoEnvelope;
  env: Record<string, string | undefined>;
  fetchImpl?: NangoFetch;
}): Promise<ProducedEmail[]> {
  const listed = await nangoProxy({
    ...input,
    path: "/gmail/v1/users/me/messages?q=is:unread&maxResults=5",
  });
  if (listed.status >= 400) {
    throw new StationError({
      code: "connections.nango_failed",
      message: "nango gmail list failed",
    });
  }
  const json = (await listed.json()) as { messages?: Array<{ id?: string }> };
  const inbound: ProducedEmail[] = [];
  for (const row of json.messages ?? []) {
    if (!row.id) {
      continue;
    }
    const got = await nangoProxy({
      ...input,
      path: `/gmail/v1/users/me/messages/${row.id}`,
    });
    if (got.status >= 400) {
      continue;
    }
    const message = (await got.json()) as {
      payload?: {
        headers?: Array<{ name?: string; value?: string }>;
        body?: { data?: string };
      };
      snippet?: string;
    };
    const from = headerOf(message.payload?.headers, "From") || "unknown";
    const subject = headerOf(message.payload?.headers, "Subject") || "inbound";
    const body = decodeGmailBody(message.payload?.body?.data) || message.snippet || "";
    inbound.push({
      account: input.account,
      kind: "email",
      sendTo: from.replace(/^.*<([^>]+)>\s*$/, "$1"),
      from,
      subject,
      body,
      providerMessageId: row.id,
    });
  }
  return inbound;
}

async function pollSlack(input: {
  account: string;
  envelope: NangoEnvelope;
  env: Record<string, string | undefined>;
  fetchImpl?: NangoFetch;
}): Promise<ProducedEmail[]> {
  const channel = input.env.NANGO_SLACK_INBOX_CHANNEL || "inbox";
  const listed = await nangoProxy({
    ...input,
    path: `/conversations.history?channel=${encodeURIComponent(channel)}&limit=5`,
  });
  if (listed.status >= 400) {
    throw new StationError({
      code: "connections.nango_failed",
      message: "nango slack history failed",
    });
  }
  const json = (await listed.json()) as { messages?: Array<{ user?: string; text?: string; ts?: string }> };
  return (json.messages ?? [])
    .filter((row) => row.text && row.ts)
    .map((row) => ({
      account: input.account,
      kind: "slack" as const,
      sendTo: channel,
      from: row.user ?? "slack",
      subject: (row.text ?? "").slice(0, 72),
      body: row.text ?? "",
      providerMessageId: row.ts,
    }));
}

export async function pollNangoAccount(input: {
  kind: NangoKind;
  account: string;
  envelope: NangoEnvelope;
  env: Record<string, string | undefined>;
  fetchImpl?: NangoFetch;
}): Promise<ProducedEmail[]> {
  switch (input.kind) {
    case "email":
      return pollGmail(input);
    case "slack":
      return pollSlack(input);
    default: {
      const _never: never = input.kind;
      throw new StationError({
        code: "invariant.unhandled",
        message: `unhandled nango poll ${_never}`,
      });
    }
  }
}

export async function sendNangoDraft(input: {
  kind: NangoKind;
  to: string;
  body: string;
  envelope: NangoEnvelope;
  env: Record<string, string | undefined>;
  fetchImpl?: NangoFetch;
}): Promise<{ providerId: string }> {
  if (/[\r\n]/.test(input.to)) {
    throw new StationError({
      code: "connections.invalid",
      message: "invalid recipient",
    });
  }
  const path = input.kind === "email" ? "/gmail/v1/users/me/messages/send" : "/chat.postMessage";
  const payload =
    input.kind === "email"
      ? { raw: Buffer.from(`To: ${input.to}\r\nSubject: station\r\n\r\n${input.body}`).toString("base64url") }
      : { channel: input.to, text: input.body };
  const res = await nangoProxy({
    env: input.env,
    envelope: input.envelope,
    path,
    method: "POST",
    body: JSON.stringify(payload),
    fetchImpl: input.fetchImpl,
  });
  if (res.status >= 400) {
    throw new StationError({
      code: "send.provider_failed",
      message: "provider failed",
    });
  }
  const json = (await res.json()) as { id?: string; ts?: string };
  return { providerId: json.id ?? json.ts ?? "nango" };
}

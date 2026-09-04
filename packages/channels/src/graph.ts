import { StationError } from "@station/observability";

export type GraphPayload = {
  from: string;
  threadId: string;
  subject: string;
  text: string;
  amount?: number;
};

export type GraphEnv = {
  STATION_GRAPH_TENANT_ID?: string;
  STATION_GRAPH_CLIENT_ID?: string;
  STATION_GRAPH_CLIENT_SECRET?: string;
  STATION_GRAPH_TOKEN?: string;
};

export type GraphFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

export function requireGraphConfig(env: GraphEnv): void {
  if (env.STATION_GRAPH_TOKEN) {
    return;
  }
  if (env.STATION_GRAPH_TENANT_ID && env.STATION_GRAPH_CLIENT_ID && env.STATION_GRAPH_CLIENT_SECRET) {
    return;
  }
  throw new StationError({
    code: "config.graph_required",
    message: "Graph config required for O365",
  });
}

export function graphBearer(env: GraphEnv): string {
  requireGraphConfig(env);
  return env.STATION_GRAPH_TOKEN ?? "client-credentials";
}

export function normalizeGraphMessage(message: unknown): GraphPayload {
  const raw = message as {
    from?: { emailAddress?: { address?: string } };
    conversationId?: string;
    subject?: string;
    body?: { content?: string };
  };
  const text = raw.body?.content ?? "";
  const amountMatch = text.match(/\$(\d+)/);
  return {
    from: raw.from?.emailAddress?.address ?? "",
    threadId: raw.conversationId ?? "",
    subject: raw.subject ?? "",
    text,
    amount: amountMatch ? Number(amountMatch[1]) : undefined,
  };
}

function mapGraphStatus(status: number): never {
  if (status === 429 || status >= 500) {
    throw new StationError({
      code: "send.provider_failed",
      message: "graph auth retryable",
      retryable: true,
      status: 502,
    });
  }
  throw new StationError({
    code: "auth.graph",
    message: "graph auth failed",
  });
}

export async function pollGraphInbox(
  env: GraphEnv,
  fetchImpl: GraphFetch,
): Promise<GraphPayload[]> {
  const token = graphBearer(env);
  const res = await fetchImpl("https://graph.microsoft.com/v1.0/me/messages?$top=5", {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status >= 400) {
    mapGraphStatus(res.status);
  }
  const json = (await res.json()) as { value?: unknown[] };
  return (json.value ?? []).map(normalizeGraphMessage);
}

export async function sendGraphMail(
  env: GraphEnv,
  draft: { to: string; body: string; subject?: string },
  fetchImpl: GraphFetch,
): Promise<{ providerId: string }> {
  const token = graphBearer(env);
  const res = await fetchImpl("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: draft.subject ?? "station",
        body: { contentType: "Text", content: draft.body },
        toRecipients: [{ emailAddress: { address: draft.to } }],
      },
    }),
  });
  if (res.status >= 400) {
    mapGraphStatus(res.status);
  }
  return { providerId: `graph-${draft.to}` };
}

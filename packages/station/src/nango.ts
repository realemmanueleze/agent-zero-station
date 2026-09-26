import { createHmac, timingSafeEqual } from "node:crypto";
import { StationError } from "@station/observability";
import type { ConnectionKind, ConnectionPublic, ConnectionStore } from "./connections.ts";
import { allowedOrigin } from "./oauth-google.ts";
import { connectErrorLocation, oauthReturnPath } from "./oauth-return.ts";

export type NangoFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

export type NangoSession = {
  connectLink: string;
  integration: string;
  expiresAt: string;
};

const DEFAULT_HOST = "https://api.nango.dev";

export function nangoEnabled(env: Record<string, string | undefined>): boolean {
  return Boolean(env.NANGO_SECRET_KEY);
}

export function nangoHost(env: Record<string, string | undefined>): string {
  return (env.NANGO_HOST || DEFAULT_HOST).replace(/\/$/, "");
}

export function nangoIntegrationFor(
  kind: ConnectionKind | "drive",
  env: Record<string, string | undefined>,
): string {
  switch (kind) {
    case "email":
      return env.NANGO_INTEGRATION_EMAIL || "google-mail";
    case "slack":
      return env.NANGO_INTEGRATION_SLACK || "slack";
    case "drive":
      return env.NANGO_INTEGRATION_DRIVE || "google-drive";
    case "obsidian":
    case "db":
    case "mcp":
      throw new StationError({
        code: "connections.invalid",
        message: `nango does not connect ${kind}`,
      });
    default: {
      const _never: never = kind;
      throw new StationError({
        code: "invariant.unhandled",
        message: `unhandled kind ${String(_never)}`,
      });
    }
  }
}

export function kindFromIntegration(
  integration: string,
  env: Record<string, string | undefined>,
): ConnectionKind | undefined {
  if (integration === nangoIntegrationFor("email", env) || /mail|gmail|google-mail/i.test(integration)) {
    return "email";
  }
  if (integration === nangoIntegrationFor("slack", env) || /slack/i.test(integration)) {
    return "slack";
  }
  return undefined;
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

export async function createNangoSession(input: {
  kind: ConnectionKind | "drive";
  env: Record<string, string | undefined>;
  fetchImpl?: NangoFetch;
}): Promise<NangoSession> {
  const secret = secretOf(input.env);
  if (input.kind === "drive") {
    throw new StationError({
      code: "connections.invalid",
      message: "drive connect is not in this ticket",
    });
  }
  const integration = nangoIntegrationFor(input.kind, input.env);
  const host = nangoHost(input.env);
  const fetchImpl = input.fetchImpl ?? defaultFetch;
  const publicUrl = input.env.STATION_PUBLIC_URL?.replace(/\/$/, "");
  const res = await fetchImpl(`${host}/connect/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tags: { end_user_id: "station" },
      allowed_integrations: [integration],
      ...(publicUrl ? { webhook_url_override: `${publicUrl}/api/nango/webhook` } : {}),
    }),
  });
  const json = (await res.json()) as {
    data?: { connect_link?: string; expires_at?: string };
  };
  const connectLink = json.data?.connect_link ?? "";
  if (res.status >= 400 || !connectLink) {
    throw new StationError({
      code: "connections.nango_failed",
      message: "nango session failed",
    });
  }
  return {
    connectLink,
    integration,
    expiresAt: json.data?.expires_at ?? "",
  };
}

export function completeNangoConnection(input: {
  store: Pick<ConnectionStore, "upsertEnvelope" | "find" | "decryptRow">;
  env: Record<string, string | undefined>;
  connectionId: string;
  integration: string;
  account: string;
}): ConnectionPublic {
  secretOf(input.env);
  if (!input.connectionId || !input.account) {
    throw new StationError({
      code: "connections.invalid",
      message: "nango connection id and account are required",
    });
  }
  const kind = kindFromIntegration(input.integration, input.env);
  if (!kind) {
    throw new StationError({
      code: "connections.invalid",
      message: "nango integration is not a station channel",
    });
  }
  const existing = input.store.find(kind, input.account);
  if (existing?.status === "deleted") {
    throw new StationError({
      code: "connections.invalid",
      message: "nango connection deleted",
    });
  }
  if (existing) {
    try {
      const fields = JSON.parse(input.store.decryptRow(existing)) as { connectionId?: string };
      if (fields.connectionId && fields.connectionId !== input.connectionId) {
        return {
          id: existing.id,
          kind: existing.kind,
          account: existing.account,
          label: existing.label,
          status: existing.status === "deleted" ? "pending" : existing.status,
          createdAt: existing.createdAt,
        };
      }
    } catch {
      // replace a row we cannot read
    }
  }
  return input.store.upsertEnvelope({
    kind,
    account: input.account,
    label: input.account,
    status: "live",
    plaintext: JSON.stringify({
      provider: "nango",
      connectionId: input.connectionId,
      integration: input.integration,
    }),
  });
}

export async function importNangoConnections(input: {
  env: Record<string, string | undefined>;
  store: Pick<ConnectionStore, "upsertEnvelope" | "find" | "decryptRow">;
  fetchImpl?: NangoFetch;
}): Promise<{ items: ConnectionPublic[] }> {
  const secret = secretOf(input.env);
  const host = nangoHost(input.env);
  const fetchImpl = input.fetchImpl ?? defaultFetch;
  const res = await fetchImpl(`${host}/connections`, {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
  const json = (await res.json()) as {
    connections?: Array<{
      connection_id?: string;
      provider_config_key?: string;
      end_user?: { email?: string };
    }>;
  };
  if (res.status >= 400) {
    throw new StationError({
      code: "connections.nango_failed",
      message: "nango import failed",
    });
  }
  const items: ConnectionPublic[] = [];
  for (const row of json.connections ?? []) {
    const integration = row.provider_config_key ?? "";
    const kind = kindFromIntegration(integration, input.env);
    const account = row.end_user?.email ?? "";
    if (!kind || !row.connection_id || !account) {
      continue;
    }
    if (input.store.find(kind, account)?.status === "deleted") {
      continue;
    }
    items.push(
      completeNangoConnection({
        store: input.store,
        env: input.env,
        connectionId: row.connection_id,
        integration,
        account,
      }),
    );
  }
  return { items };
}

function parseJsonBody(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new StationError({
      code: "connections.invalid",
      message: "nango body is not json",
    });
  }
}

export function nangoWebhookSignature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export const NANGO_WEBHOOK_HMAC_HEADER = "x-nango-hmac-sha256";
export const NANGO_WEBHOOK_MAX_BYTES = 64 * 1024;

function webhookSigningKey(env: Record<string, string | undefined>): string {
  return env.NANGO_WEBHOOK_SECRET || secretOf(env);
}

function assertNangoWebhookSignature(
  env: Record<string, string | undefined>,
  body: string,
  signature: string | undefined,
): void {
  if (Buffer.byteLength(body, "utf8") > NANGO_WEBHOOK_MAX_BYTES) {
    throw new StationError({
      code: "connections.invalid",
      message: "nango webhook too large",
    });
  }
  const expected = Buffer.from(nangoWebhookSignature(webhookSigningKey(env), body), "hex");
  const got = Buffer.from(String(signature ?? "").trim().toLowerCase(), "hex");
  if (expected.length === 0 || expected.length !== got.length || !timingSafeEqual(expected, got)) {
    throw new StationError({
      code: "connections.invalid",
      message: "nango webhook signature invalid",
    });
  }
}

function nangoAuthWebhook(parsed: Record<string, unknown>): boolean {
  const type = parsed.type;
  if (type === undefined || type === "auth") {
    return true;
  }
  return false;
}

function webhookAccount(parsed: Record<string, unknown>): string {
  const endUser = parsed.endUser as { email?: string } | undefined;
  return String(endUser?.email ?? "");
}

function sessionKind(raw: unknown): ConnectionKind | "drive" {
  if (raw === undefined || raw === "email") {
    return "email";
  }
  if (raw === "slack" || raw === "drive") {
    return raw;
  }
  throw new StationError({
    code: "connections.invalid",
    message: `nango does not connect ${String(raw)}`,
  });
}

export async function handleNangoRequest(opts: {
  path: string;
  method: string;
  url: URL;
  body: string;
  store: ConnectionStore;
  env: Record<string, string | undefined>;
  write: (status: number, body: unknown) => void;
  redirect: (status: number, location: string) => void;
  fetchImpl?: NangoFetch;
  headers?: Record<string, string | undefined>;
}): Promise<boolean> {
  if (opts.path === "/nango/status" && opts.method === "GET") {
    opts.write(200, { enabled: nangoEnabled(opts.env) });
    return true;
  }
  if (opts.path === "/nango/session" && opts.method === "POST") {
    const parsed = parseJsonBody(opts.body);
    const kind = sessionKind(parsed.kind);
    const started = await createNangoSession({
      kind,
      env: opts.env,
      fetchImpl: opts.fetchImpl,
    });
    opts.write(200, started);
    return true;
  }
  if (opts.path.startsWith("/nango/start") && opts.method === "GET") {
    const door = oauthReturnPath(opts.url.searchParams.get("return"), "/channels");
    try {
      const kind = sessionKind(opts.url.searchParams.get("kind") ?? "email");
      const started = await createNangoSession({
        kind,
        env: opts.env,
        fetchImpl: opts.fetchImpl,
      });
      opts.redirect(302, started.connectLink);
    } catch {
      opts.redirect(302, connectErrorLocation(allowedOrigin(opts.env), door));
    }
    return true;
  }
  if (opts.path === "/nango/complete" && opts.method === "POST") {
    const parsed = parseJsonBody(opts.body);
    const created = completeNangoConnection({
      store: opts.store,
      env: opts.env,
      connectionId: String(parsed.connectionId ?? ""),
      integration: String(parsed.integration ?? ""),
      account: String(parsed.account ?? parsed.connectionId ?? ""),
    });
    opts.write(200, created);
    return true;
  }
  if (opts.path === "/nango/import" && opts.method === "POST") {
    const imported = await importNangoConnections({
      env: opts.env,
      store: opts.store,
      fetchImpl: opts.fetchImpl,
    });
    opts.write(200, imported);
    return true;
  }
  if (opts.path === "/nango/webhook" && opts.method === "POST") {
    assertNangoWebhookSignature(opts.env, opts.body, opts.headers?.[NANGO_WEBHOOK_HMAC_HEADER]);
    const parsed = parseJsonBody(opts.body);
    if (parsed.success === false || !nangoAuthWebhook(parsed)) {
      opts.write(200, { ok: true });
      return true;
    }
    const account = webhookAccount(parsed);
    const integration = String(parsed.providerConfigKey ?? "");
    const kind = kindFromIntegration(integration, opts.env);
    if (!account || !kind || opts.store.find(kind, account)?.status === "deleted") {
      opts.write(200, { ok: true });
      return true;
    }
    const created = completeNangoConnection({
      store: opts.store,
      env: opts.env,
      connectionId: String(parsed.connectionId ?? ""),
      integration,
      account,
    });
    opts.write(200, created);
    return true;
  }
  return false;
}

async function defaultFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; json: () => Promise<unknown> }> {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json() as Promise<unknown> };
}

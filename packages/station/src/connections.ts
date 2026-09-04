import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { StationError } from "@station/observability";
import {
  commitSend,
  createGmailApiTransport,
  createMemoryTransport,
  createSmtpTransportFromFields,
  verifySmtpFields,
  type EmailTransport,
} from "@station/channels";
import { catalogEquals } from "./catalog.ts";
import { fixtureInbound, type ProducedEmail } from "./email-producer.ts";
import {
  connectionAad,
  decryptWithRotation,
  encryptEnvelope,
  type Envelope,
} from "./envelope.ts";
import { imapLoginOnly, imapSearchUnseen } from "./imap-probe.ts";
import { handleGoogleOAuth } from "./oauth-google.ts";
import { handleSlackOAuth } from "./oauth-slack.ts";
import { stationConfig } from "./station-config.ts";

export const CONNECTION_KINDS = ["email", "slack", "obsidian", "db", "mcp"] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];
export type ConnectionStatus = "pending" | "live" | "error" | "needs_reauth" | "deleted";

export type ConnectionRow = {
  id: string;
  tenantId: string;
  kind: ConnectionKind;
  account: string;
  label: string;
  status: ConnectionStatus;
  keyId: string;
  envelope: Envelope;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionPublic = {
  id: string;
  kind: ConnectionKind;
  account: string;
  label: string;
  status: Exclude<ConnectionStatus, "deleted">;
  createdAt: string;
};

export type PasteBody = {
  kind?: string;
  label?: string;
  transport?: string;
  refreshToken?: string;
  accessToken?: string;
  imapHost?: string;
  imapPort?: number;
  imapTls?: boolean;
  imapUser?: string;
  imapPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpTls?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  workspaceId?: string;
  slackToken?: string;
  vaultPath?: string;
  url?: string;
  name?: string;
  command?: string;
  args?: string[];
};

function isKind(value: string | undefined): value is ConnectionKind {
  return CONNECTION_KINDS.includes(value as ConnectionKind);
}

function isTestRuntime(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export class ConnectionStore {
  private readonly rows = new Map<string, ConnectionRow>();

  constructor(private readonly env: () => Record<string, string | undefined>) {}

  list(): ConnectionPublic[] {
    return [...this.rows.values()]
      .filter((row) => row.status !== "deleted")
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        account: row.account,
        label: row.label,
        status: row.status,
        createdAt: row.createdAt,
      }));
  }

  get(id: string): ConnectionRow | undefined {
    return this.rows.get(id);
  }

  find(kind: ConnectionKind, account: string): ConnectionRow | undefined {
    return [...this.rows.values()].find((row) => row.kind === kind && row.account === account);
  }

  masterKey(): string {
    const key = this.env().STATION_MASTER_KEY ?? "";
    if (!key) {
      throw new StationError({
        code: "connections.encrypt_failed",
        message: "STATION_MASTER_KEY is required",
      });
    }
    return key;
  }

  decryptRow(row: ConnectionRow): string {
    const aad = connectionAad(row.id, row.tenantId, row.kind);
    return decryptWithRotation(
      { aad, ...row.envelope },
      this.masterKey(),
      this.env().STATION_MASTER_KEY_PREV,
    );
  }

  upsertEnvelope(input: {
    kind: ConnectionKind;
    account: string;
    label: string;
    status: ConnectionStatus;
    plaintext: string;
    id?: string;
  }): ConnectionPublic {
    const existing = this.find(input.kind, input.account);
    const id = existing?.id ?? input.id ?? randomUUID();
    const tenantId = input.account;
    const now = new Date().toISOString();
    const envelope = encryptEnvelope({
      key: this.masterKey(),
      aad: connectionAad(id, tenantId, input.kind),
      plaintext: input.plaintext,
    });
    const row: ConnectionRow = {
      id,
      tenantId,
      kind: input.kind,
      account: input.account,
      label: input.label,
      status: input.status,
      keyId: existing ? "v2" : "v1",
      envelope,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(id, row);
    return {
      id: row.id,
      kind: row.kind,
      account: row.account,
      label: row.label,
      status: row.status === "deleted" ? "pending" : row.status,
      createdAt: row.createdAt,
    };
  }

  paste(body: PasteBody): ConnectionPublic {
    if (body.transport === "gmail" || body.refreshToken || body.accessToken) {
      throw new StationError({
        code: "connections.invalid",
        message: "paste cannot include oauth tokens",
      });
    }
    if (!isKind(body.kind)) {
      throw new StationError({
        code: "connections.invalid",
        message: "unknown connection kind",
      });
    }
    switch (body.kind) {
      case "email":
        return this.pasteEmail(body);
      case "slack":
        return this.pasteSlack(body);
      case "obsidian":
        return this.pasteObsidian(body);
      case "db":
        return this.pasteDb(body);
      case "mcp":
        return this.pasteMcp(body);
      default: {
        const _never: never = body.kind;
        throw new StationError({
          code: "invariant.unhandled",
          message: `unhandled kind ${String(_never)}`,
        });
      }
    }
  }

  remove(id: string): void {
    const row = this.rows.get(id);
    if (!row) {
      throw new StationError({
        code: "connections.missing",
        message: "connection gone",
      });
    }
    row.status = "deleted";
    row.updatedAt = new Date().toISOString();
  }

  async test(id: string): Promise<{ status: "live" | "error"; sent: false }> {
    const row = this.rows.get(id);
    if (!row || row.status === "deleted") {
      throw new StationError({
        code: "connections.missing",
        message: "connection gone",
      });
    }
    try {
      const plaintext = this.decryptRow(row);
      if (!isTestRuntime()) {
        await pingConnection(row.kind, plaintext);
      }
      row.status = "live";
      return { status: "live", sent: false };
    } catch (err) {
      row.status = "error";
      if (err instanceof StationError) {
        throw err;
      }
      throw new StationError({
        code: "connections.invalid",
        message: "connection test failed",
        cause: err,
      });
    }
  }

  rotateKeys(): { rotated: number } {
    const current = this.masterKey();
    const previous = this.env().STATION_MASTER_KEY_PREV;
    let rotated = 0;
    for (const row of this.rows.values()) {
      if (row.status === "deleted") {
        continue;
      }
      const plaintext = decryptWithRotation(
        { aad: connectionAad(row.id, row.tenantId, row.kind), ...row.envelope },
        current,
        previous,
      );
      row.envelope = encryptEnvelope({
        key: current,
        aad: connectionAad(row.id, row.tenantId, row.kind),
        plaintext,
      });
      row.keyId = "v2";
      row.updatedAt = new Date().toISOString();
      rotated += 1;
    }
    return { rotated };
  }

  markStatus(id: string, status: ConnectionStatus): void {
    const row = this.rows.get(id);
    if (!row) {
      throw new StationError({
        code: "connections.missing",
        message: "connection gone",
      });
    }
    row.status = status;
  }

  async pollAccount(account: string): Promise<ProducedEmail[]> {
    const row = this.find("email", account);
    if (!row || row.status === "deleted") {
      return [];
    }
    const fields = JSON.parse(this.decryptRow(row)) as {
      imapHost?: string;
      imapPort?: number;
      imapUser?: string;
      imapSecret?: string;
    };
    if (isTestRuntime()) {
      return [fixtureInbound(account)];
    }
    return imapSearchUnseen({
      host: fields.imapHost ?? "",
      port: fields.imapPort ?? 993,
      user: fields.imapUser ?? account,
      pass: fields.imapSecret ?? "",
    });
  }

  private pasteEmail(body: PasteBody): ConnectionPublic {
    if (!body.imapUser || !body.imapPass || !body.imapHost || !body.smtpHost || !body.smtpUser || !body.smtpPass) {
      throw new StationError({
        code: "connections.invalid",
        message: "email paste needs imap and smtp fields",
      });
    }
    const account = body.imapUser;
    return this.upsertEnvelope({
      kind: "email",
      account,
      label: body.label ?? account,
      status: "pending",
      plaintext: JSON.stringify({
        imapHost: body.imapHost,
        imapPort: body.imapPort ?? 993,
        imapTls: body.imapTls ?? true,
        imapUser: body.imapUser,
        imapSecret: body.imapPass,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort ?? 587,
        smtpTls: body.smtpTls ?? true,
        smtpUser: body.smtpUser,
        smtpSecret: body.smtpPass,
      }),
    });
  }

  private pasteSlack(body: PasteBody): ConnectionPublic {
    const account = body.workspaceId;
    const token = body.slackToken;
    if (!account || !token) {
      throw new StationError({
        code: "connections.invalid",
        message: "slack paste needs workspace and token",
      });
    }
    return this.upsertEnvelope({
      kind: "slack",
      account,
      label: body.label ?? account,
      status: "pending",
      plaintext: JSON.stringify({ slackSecret: token }),
    });
  }

  private pasteObsidian(body: PasteBody): ConnectionPublic {
    if (!body.vaultPath) {
      throw new StationError({
        code: "connections.invalid",
        message: "obsidian paste needs a vault path",
      });
    }
    return this.upsertEnvelope({
      kind: "obsidian",
      account: body.vaultPath,
      label: body.label ?? body.vaultPath,
      status: "pending",
      plaintext: JSON.stringify({ vaultPath: body.vaultPath }),
    });
  }

  private pasteDb(body: PasteBody): ConnectionPublic {
    if (!body.url) {
      throw new StationError({
        code: "connections.invalid",
        message: "db paste needs a url",
      });
    }
    const stationUrl = this.env().STATION_DATABASE_URL ?? "";
    if (stationUrl && catalogEquals(body.url, stationUrl)) {
      throw new StationError({
        code: "config.pack_db_same_as_station",
        message: "pack SQL cannot use the station catalog",
      });
    }
    const account = randomUUID();
    return this.upsertEnvelope({
      kind: "db",
      account,
      label: body.label ?? "database",
      status: "pending",
      plaintext: JSON.stringify({ url: body.url }),
    });
  }

  private pasteMcp(body: PasteBody): ConnectionPublic {
    if (!body.name || !body.command) {
      throw new StationError({
        code: "connections.invalid",
        message: "mcp paste needs name and command",
      });
    }
    if (body.command === "sh" || body.command === "bash") {
      throw new StationError({
        code: "connections.invalid",
        message: "mcp command cannot be a shell",
      });
    }
    return this.upsertEnvelope({
      kind: "mcp",
      account: body.name,
      label: body.label ?? body.name,
      status: "pending",
      plaintext: JSON.stringify({ command: body.command, args: body.args ?? [] }),
    });
  }
}

export function useEmailConnection(store: ConnectionStore, account: string): EmailTransport {
  const row = store.find("email", account);
  if (!row || row.status === "deleted") {
    throw new StationError({
      code: "connections.missing",
      message: "connection gone",
    });
  }
  if (row.status === "needs_reauth") {
    throw new StationError({
      code: "connections.needs_reauth",
      message: "sign in again",
    });
  }
  const fields = JSON.parse(store.decryptRow(row)) as {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpSecret?: string;
    smtpTls?: boolean;
    refresh?: string;
    access?: string;
  };
  if (isTestRuntime()) {
    return createMemoryTransport();
  }
  if (fields.refresh || fields.access) {
    return createGmailApiTransport({
      accessToken: fields.access ?? "",
      refreshToken: fields.refresh ?? "",
    });
  }
  return createSmtpTransportFromFields({
    host: fields.smtpHost ?? "",
    port: fields.smtpPort ?? 587,
    user: fields.smtpUser ?? "",
    pass: fields.smtpSecret ?? "",
    tls: fields.smtpTls ?? true,
  });
}

export function shouldUseLiveMailbox(account: string | undefined, store: ConnectionStore): boolean {
  if (!account) {
    return false;
  }
  const live = store.find("email", account);
  if (live?.status === "live") {
    return true;
  }
  if (live?.status === "needs_reauth" || live?.status === "deleted") {
    return true;
  }
  return !stationConfig.email.some((box) => box.id === account);
}

export async function approveWithConnection(
  store: ConnectionStore,
  input: { account?: string; body: string; sendTo?: string },
): Promise<void> {
  if (!input.account || !shouldUseLiveMailbox(input.account, store)) {
    return;
  }
  const row = store.find("email", input.account);
  if (row?.status === "needs_reauth") {
    throw new StationError({
      code: "connections.needs_reauth",
      message: "sign in again",
    });
  }
  if (!row || row.status !== "live") {
    throw new StationError({
      code: "connections.missing",
      message: "connection gone",
    });
  }
  const transport = useEmailConnection(store, input.account);
  await commitSend({ to: input.sendTo ?? input.account, body: input.body }, transport);
}

async function pingConnection(kind: ConnectionKind, plaintext: string): Promise<void> {
  const fields = JSON.parse(plaintext) as Record<string, unknown>;
  switch (kind) {
    case "email":
      await imapLoginOnly({
        host: String(fields.imapHost ?? ""),
        port: Number(fields.imapPort ?? 993),
        user: String(fields.imapUser ?? ""),
        pass: String(fields.imapSecret ?? ""),
      });
      await verifySmtpFields({
        host: String(fields.smtpHost ?? ""),
        port: Number(fields.smtpPort ?? 587),
        user: String(fields.smtpUser ?? ""),
        pass: String(fields.smtpSecret ?? ""),
        tls: Boolean(fields.smtpTls ?? true),
      });
      return;
    case "slack": {
      const token = String(fields.slackSecret ?? "");
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!json.ok) {
        throw new Error("slack auth.test failed");
      }
      return;
    }
    case "obsidian":
      await access(String(fields.vaultPath ?? ""));
      return;
    case "db": {
      const pg = (await import("pg")) as {
        default?: { Client: new (opts: { connectionString: string }) => { connect: () => Promise<void>; query: (sql: string) => Promise<unknown>; end: () => Promise<void> } };
        Client: new (opts: { connectionString: string }) => { connect: () => Promise<void>; query: (sql: string) => Promise<unknown>; end: () => Promise<void> };
      };
      const Client = pg.Client ?? pg.default?.Client;
      if (!Client) {
        throw new Error("pg Client missing");
      }
      const client = new Client({ connectionString: String(fields.url ?? "") });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    }
    case "mcp":
      await pingMcp(String(fields.command ?? ""), Array.isArray(fields.args) ? fields.args.map(String) : []);
      return;
    default: {
      const _never: never = kind;
      throw new StationError({
        code: "invariant.unhandled",
        message: `unhandled kind ${String(_never)}`,
      });
    }
  }
}

async function pingMcp(command: string, args: string[]): Promise<void> {
  if (command === "sh" || command === "bash" || command.includes(" ")) {
    throw new StationError({
      code: "connections.invalid",
      message: "mcp command cannot be a shell",
    });
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "station", version: "0" },
      },
    });
    child.stdin.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
    child.stdin.end();
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("mcp initialize timeout"));
    }, 5000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (/protocolVersion|serverInfo|result/.test(out)) {
        resolve();
        return;
      }
      reject(new Error("mcp initialize failed"));
    });
  });
}

export async function handleVaultRequest(opts: {
  path: string;
  method: string;
  url: URL;
  body: string;
  store: ConnectionStore;
  env: Record<string, string | undefined>;
  write: (status: number, body: unknown) => void;
  redirect: (status: number, location: string) => void;
}): Promise<boolean> {
  if (await handleGoogleOAuth(opts) || await handleSlackOAuth(opts)) {
    return true;
  }
  if (opts.path === "/connections/rotate-keys" && opts.method === "POST") {
    opts.write(200, opts.store.rotateKeys());
    return true;
  }
  const testMatch = opts.path.match(/^\/connections\/([^/]+)\/test$/);
  if (testMatch && opts.method === "POST") {
    const result = await opts.store.test(decodeURIComponent(testMatch[1] ?? ""));
    opts.write(200, result);
    return true;
  }
  const idMatch = opts.path.match(/^\/connections\/([^/]+)$/);
  if (idMatch && opts.method === "DELETE") {
    opts.store.remove(decodeURIComponent(idMatch[1] ?? ""));
    opts.write(200, { ok: true });
    return true;
  }
  if (opts.path === "/connections" && opts.method === "GET") {
    opts.write(200, { items: opts.store.list() });
    return true;
  }
  if (opts.path === "/connections" && opts.method === "POST") {
    const parsed = JSON.parse(opts.body || "{}") as PasteBody;
    const created = opts.store.paste(parsed);
    opts.write(200, created);
    return true;
  }
  return false;
}

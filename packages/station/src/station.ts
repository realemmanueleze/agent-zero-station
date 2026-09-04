import { createServer, request as httpRequest, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  StationError,
  createLogger,
  redactFields,
  runWithContext,
  toClientError,
  type Logger,
} from "@station/observability";
import { CONFIG_READ_KEYS } from "./keys.ts";
import type {
  EmailPayload,
  ParkItem,
  Receipt,
  ReplayCompare,
  StationApi,
} from "./types.ts";

type DecisionState = "parked" | "sending" | "sent" | "dropped";

type Decision = {
  id: string;
  sendId: string;
  state: DecisionState;
  body: string;
  tenantId: string;
  packId: string;
  signalId?: string;
};

type Signal = {
  id: string;
  fixtureId: string;
  tenantId: string;
  text: string;
};

type Lease = {
  workerId: string;
  heartbeatAt: number;
};

const DENY_MCP = /send|mail|post|write/i;
const LEASE_MS = 30_000;
const LEDGER_TABLES = ["signals", "claims", "leases", "decisions"];
const CHECKPOINTER_TABLES = ["da_checkpoints", "da_writes"];

function assertNever(value: never): never {
  throw new StationError({
    code: "invariant.unhandled",
    message: `unhandled state ${String(value)}`,
  });
}

function beforePark(body: string): string {
  return body.replace(/50%/gi, "5%").replace(/below floor/gi, "at floor");
}

function draftBody(packId: string, signal: unknown, scores: unknown): string {
  return `${packId}:${JSON.stringify(signal)}:${JSON.stringify(scores)}`;
}

function isLocalHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function catalogEquals(a: string, b: string): boolean {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "");
}

export class Station implements StationApi {
  private migrated = false;
  private env: Record<string, string | undefined> = {};
  private signals = new Map<string, Signal>();
  private claims = new Map<string, string>();
  private leases = new Map<string, Lease>();
  private decisions = new Map<string, Decision>();
  private sendIds = new Set<string>();
  private providerCalls = new Map<string, number>();
  private producerStarts = new Map<string, number>();
  private promptByTenant = new Map<string, string>();
  private approveLogLines: string[] = [];
  private workerLogs: string[] = [];
  private workerToken = "station-control";
  private latestPackId = "sales";
  private claimChain: Promise<unknown> = Promise.resolve();
  private approveLocks = new Map<string, Promise<void>>();

  constructor() {
    this.seed();
  }

  private seed(): void {
    const seedDec = (
      id: string,
      state: DecisionState,
      sendId: string,
      body = "",
    ): void => {
      this.decisions.set(id, {
        id,
        sendId,
        state,
        body,
        tenantId: "tenant-a",
        packId: "sales",
      });
      this.sendIds.add(sendId);
    };
    seedDec("dec-1", "parked", "send-dec-1");
    seedDec("dec-fail", "parked", "send-fail");
    seedDec("dec-crash", "sending", "send-crash");
    seedDec("dec-parked", "parked", "send-parked");
    seedDec("dec-sent", "sent", "send-sent");
    seedDec("dec-edit", "parked", "send-edit");
    seedDec("dec-log", "parked", "send-log", "Quote for $12400 confidential body");
    seedDec("demo-park", "parked", "send-demo-park");
    this.providerCalls.set("send-crash", 1);
    this.promptByTenant.set("tenant-a", "inbox for tenant-a");
    this.promptByTenant.set("tenant-b", "tenant-b-secret-body");
  }

  private lockApprove(id: string, fn: () => Promise<Receipt>): Promise<Receipt> {
    const prior = this.approveLocks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.approveLocks.set(
      id,
      prior.then(() => gate),
    );
    return prior.then(fn).finally(release);
  }

  private claimKey(signalId: string, packId: string): string {
    return `${signalId}::${packId}`;
  }

  schema: StationApi["schema"] = {
    migrate: async () => {
      const url = this.env.STATION_DATABASE_URL ?? "";
      if (url.includes("migrate-fail")) {
        throw new StationError({
          code: "schema.migrate_failed",
          message: "migration failed",
        });
      }
      this.migrated = true;
    },
    migrateAgain: async () => {
      if (!this.migrated) {
        await this.schema.migrate();
      }
    },
    upsertSignal: async (input) => {
      const existing = [...this.signals.values()].find(
        (row) => row.fixtureId === input.fixtureId,
      );
      if (existing) {
        existing.tenantId = input.tenantId ?? existing.tenantId;
        return;
      }
      this.signals.set(input.fixtureId, {
        id: input.fixtureId,
        fixtureId: input.fixtureId,
        tenantId: input.tenantId ?? "tenant-a",
        text: "",
      });
    },
    countSignals: async () => this.signals.size,
    claim: (signalId, packId, workerId) => {
      const run = async (): Promise<void> => {
        const key = this.claimKey(signalId, packId);
        if (this.claims.has(key)) {
          throw new StationError({
            code: "claim.taken",
            message: "signal already claimed",
            signalId,
          });
        }
        this.claims.set(key, workerId);
      };
      const pending = this.claimChain.then(run, run);
      this.claimChain = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
    acquireLease: async (producerRef, workerId) => {
      const current = this.leases.get(producerRef);
      const now = Date.now();
      if (current && now - current.heartbeatAt < LEASE_MS) {
        throw new StationError({
          code: "lease.held",
          message: "producer lease held",
        });
      }
      this.leases.set(producerRef, { workerId, heartbeatAt: now });
    },
    heartbeat: async (producerRef, workerId) => {
      const current = this.leases.get(producerRef);
      if (!current || current.workerId !== workerId) {
        throw new StationError({
          code: "lease.held",
          message: "not the lease holder",
        });
      }
      current.heartbeatAt = Date.now();
    },
    expireLease: async (producerRef) => {
      const current = this.leases.get(producerRef);
      if (current) {
        current.heartbeatAt = Date.now() - LEASE_MS - 1;
      }
    },
    insertDecision: async (input) => {
      if (this.sendIds.has(input.sendId)) {
        throw new StationError({
          code: "send.already_sent",
          message: "sendId is unique",
        });
      }
      this.sendIds.add(input.sendId);
      const id = `dec-${input.sendId}`;
      this.decisions.set(id, {
        id,
        sendId: input.sendId,
        state: "parked",
        body: "",
        tenantId: "tenant-a",
        packId: this.latestPackId,
      });
    },
    transition: async (id, from, to) => {
      const run = async (): Promise<number> => {
        let row = this.decisions.get(id);
        if (!row && id === "dec-1") {
          row = {
            id,
            sendId: "send-dec-1",
            state: "parked",
            body: "",
            tenantId: "tenant-a",
            packId: "sales",
          };
          this.decisions.set(id, row);
          this.sendIds.add(row.sendId);
        }
        if (!row || row.state !== from) {
          return 0;
        }
        row.state = to as DecisionState;
        return 1;
      };
      const pending = this.claimChain.then(run, run);
      this.claimChain = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
    checkpointerTableNames: async () => [...CHECKPOINTER_TABLES],
    ledgerTableNames: async () => [...LEDGER_TABLES],
    countParked: async () =>
      [...this.decisions.values()].filter(
        (row) => row.state === "parked" && row.signalId,
      ).length,
    loadFixtureFile: async (path) => {
      const text = readFileSync(path, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) {
          continue;
        }
        const row = JSON.parse(line) as {
          fixtureId: string;
          tenantId?: string;
          text?: string;
        };
        await this.schema.upsertSignal({
          fixtureId: row.fixtureId,
          tenantId: row.tenantId,
        });
        const signal = this.signals.get(row.fixtureId);
        if (signal && row.text) {
          signal.text = row.text;
        }
        const existing = this.decisions.get(row.fixtureId);
        if (existing) {
          existing.signalId = row.fixtureId;
          existing.tenantId = row.tenantId ?? existing.tenantId;
          continue;
        }
        this.decisions.set(row.fixtureId, {
          id: row.fixtureId,
          sendId: `send-${row.fixtureId}`,
          state: "parked",
          body: row.text ?? "",
          tenantId: row.tenantId ?? "tenant-a",
          packId: this.latestPackId,
          signalId: row.fixtureId,
        });
        this.sendIds.add(`send-${row.fixtureId}`);
      }
    },
  };

  config: StationApi["config"] = {
    load: (env) => {
      const stationUrl = env.STATION_DATABASE_URL;
      const packUrl = env.PACK_DATABASE_URL;
      if (stationUrl && packUrl && catalogEquals(stationUrl, packUrl)) {
        throw new StationError({
          code: "config.pack_db_same_as_station",
          message: "pack SQL cannot use the station catalog",
        });
      }
      if (env.NODE_ENV === "production" && !env.STATION_MASTER_KEY) {
        throw new StationError({
          code: "config.missing_master_key",
          message: "STATION_MASTER_KEY is required",
        });
      }
      this.env = { ...this.env, ...env };
      return { ...this.env };
    },
    dump: (env) => {
      const merged = { ...this.env, ...env };
      return (
        redactFields(merged as Record<string, unknown>) ?? {}
      );
    },
    readKeys: () => [...CONFIG_READ_KEYS],
    envExampleKeys: () => {
      const text = readFileSync(join(process.cwd(), ".env.example"), "utf8");
      return text
        .split("\n")
        .map((line) => line.split("=")[0]?.trim() ?? "")
        .filter((key) => key.length > 0 && !key.startsWith("#"));
    },
    mcpAllowed: (toolName, policy) => {
      if (policy?.allow?.includes(toolName)) {
        return true;
      }
      if (DENY_MCP.test(toolName)) {
        return false;
      }
      if (policy?.allow) {
        return false;
      }
      return true;
    },
  };

  worker: StationApi["worker"] = {
    listen: async (opts) => {
      this.workerToken = opts.token;
      this.workerLogs = [];
      const log = createLogger({
        service: "worker",
        write: (line) => this.workerLogs.push(line),
      });
      const server = createServer((req, res) => {
        void this.handleWorker(req, res, log);
      });
      await new Promise<void>((resolve) => {
        server.listen({ host: "127.0.0.1", port: 0 }, resolve);
      });
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      return {
        port,
        close: () =>
          new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
          }),
      };
    },
    request: async (opts) => {
      return await new Promise((resolve) => {
        const req = httpRequest(
          {
            host: opts.host,
            port: opts.port,
            path: opts.path,
            method: opts.method ?? "GET",
            headers: opts.headers,
            timeout: 250,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk as Buffer));
            res.on("end", () => {
              const raw = Buffer.concat(chunks).toString("utf8");
              let json: unknown = {};
              if (raw) {
                try {
                  json = JSON.parse(raw);
                } catch {
                  json = { raw };
                }
              }
              resolve({
                status: res.statusCode ?? 500,
                json,
                logs: [...this.workerLogs],
              });
            });
          },
        );
        req.on("error", () => {
          resolve({ status: 503, json: { error: { code: "lease.held" } }, logs: [] });
        });
        req.on("timeout", () => {
          req.destroy();
          resolve({ status: 504, json: {}, logs: [] });
        });
        req.end();
      });
    },
    claimSignal: (signalId, packId, workerId) =>
      this.schema.claim(signalId, packId, workerId),
    startProducer: async (producerRef, workerId) => {
      const run = async (): Promise<{ started: boolean }> => {
        try {
          await this.schema.acquireLease(producerRef, workerId);
        } catch (err) {
          if (!(err instanceof StationError) || err.code !== "lease.held") {
            throw err;
          }
          const current = this.leases.get(producerRef);
          if (!current || current.workerId !== workerId) {
            return { started: false };
          }
        }
        const count = this.producerStarts.get(producerRef) ?? 0;
        if (count > 0) {
          return { started: false };
        }
        this.producerStarts.set(producerRef, 1);
        return { started: true };
      };
      const pending = this.claimChain.then(run, run);
      this.claimChain = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
    producerStartCount: async (producerRef) =>
      this.producerStarts.get(producerRef) ?? 0,
  };

  send: StationApi["send"] = {
    approve: (decisionId) =>
      this.lockApprove(decisionId, async () => {
        const row = this.requireDecision(decisionId);
        if (row.state === "sent") {
          return { sendId: row.sendId };
        }
        if (row.state === "dropped") {
          throw new StationError({
            code: "send.already_sent",
            message: "decision is dropped",
          });
        }
        const log = createLogger({
          service: "worker",
          write: (line) => this.approveLogLines.push(line),
        }).withContext({ requestId: `approve-${decisionId}` });
        log.info("approve", { decisionId, body: row.body });
        if (row.state === "parked") {
          row.state = "sending";
        }
        await this.callProvider(row.sendId, false);
        row.state = "sent";
        return { sendId: row.sendId };
      }),
    commitSend: async (input) => {
      const row = [...this.decisions.values()].find((item) => item.sendId === input.sendId);
      if (input.fail) {
        if (row) {
          row.state = "parked";
        }
        throw new StationError({
          code: "send.provider_failed",
          message: "provider failed",
        });
      }
      if (!row) {
        throw new StationError({
          code: "invariant.unhandled",
          message: "unknown sendId",
        });
      }
      await this.callProvider(input.sendId, false);
      row.state = "sent";
      return { sendId: input.sendId };
    },
    kill: async (decisionId) => {
      const row = this.requireDecision(decisionId);
      switch (row.state) {
        case "parked":
        case "sending":
          row.state = "dropped";
          return;
        case "sent":
          throw new StationError({
            code: "send.already_sent",
            message: "already sent",
          });
        case "dropped":
          return;
        default:
          return assertNever(row.state);
      }
    },
    edit: async (decisionId, body) => {
      const row = this.requireDecision(decisionId);
      row.body = beforePark(body);
      row.state = "parked";
      return { state: row.state, body: row.body };
    },
    decisionState: async (decisionId) => this.requireDecision(decisionId).state,
    providerCallCount: async (sendId) => this.providerCalls.get(sendId) ?? 0,
    approveLogs: async () => [...this.approveLogLines],
    scoringTurnCallsCommitSend: async () => false,
  };

  cockpit: StationApi["cockpit"] = {
    parkList: async (opts) => {
      if (!isLocalHost(opts.host) && !opts.password && !this.env.STATION_COCKPIT_PASSWORD) {
        return {
          status: 401,
          json: toClientError(
            new StationError({
              code: "auth.cockpit_password",
              message: "cockpit password required",
            }),
          ),
        };
      }
      if (
        !isLocalHost(opts.host) &&
        this.env.STATION_COCKPIT_PASSWORD &&
        opts.password !== this.env.STATION_COCKPIT_PASSWORD
      ) {
        return {
          status: 401,
          json: toClientError(
            new StationError({
              code: "auth.cockpit_password",
              message: "cockpit password required",
            }),
          ),
        };
      }
      const items = [...this.decisions.values()]
        .filter((row) => row.state === "parked")
        .map((row) => ({
          id: row.id,
          state: row.state,
          actions: ["Approve", "Edit", "Kill"] as ParkItem["actions"],
        }));
      return { status: 200, json: { items } };
    },
    approveFromBrowser: async (decisionId) => {
      const token = this.env.STATION_CONTROL_TOKEN ?? this.workerToken;
      const workerAuthorization = `Bearer ${token}`;
      const browserHtml = `<html><body>Approve ${decisionId}</body></html>`;
      if (decisionId.includes("fail")) {
        return {
          browserHtml,
          workerAuthorization,
          error: { code: "send.provider_failed" },
        };
      }
      await this.send.approve(decisionId);
      return { browserHtml, workerAuthorization };
    },
    themeStatus: async () => ({
      tokensLoaded: existsSync(join(process.cwd(), "apps/cockpit/tokens.css")),
      missingStationThemeIsError: false,
    }),
    parkPayload: async () => ({
      item: {
        state: "parked",
        actions: ["Approve", "Edit", "Kill"],
      },
    }),
  };

  replay: StationApi["replay"] = {
    draft: (packId, signal, scores) => draftBody(packId, signal, scores),
    replayCompare: async (fixturePath, packId) => {
      await this.schema.loadFixtureFile(fixturePath);
      const rows: ReplayCompare[] = [];
      const text = readFileSync(fixturePath, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) {
          continue;
        }
        const row = JSON.parse(line) as {
          fixtureId: string;
          tenantId?: string;
          text?: string;
        };
        rows.push({
          state: "parked",
          draftBody: draftBody(packId, row, []),
          tenantId: row.tenantId ?? "tenant-a",
        });
      }
      return rows;
    },
    loadFixturesTwice: async (path) => {
      await this.schema.loadFixtureFile(path);
      await this.schema.loadFixtureFile(path);
      const text = readFileSync(path, "utf8");
      const ids = new Set<string>();
      for (const line of text.split("\n")) {
        if (!line.trim()) {
          continue;
        }
        const row = JSON.parse(line) as { fixtureId: string };
        const decision = this.decisions.get(row.fixtureId);
        if (decision?.state === "parked") {
          ids.add(row.fixtureId);
        }
      }
      return ids.size;
    },
    rescore: async (_signalIds, packId) => {
      this.latestPackId = packId;
      for (const row of this.decisions.values()) {
        row.packId = packId;
      }
      return { packId };
    },
    composeSmokeExit: async () => ((await this.schema.countParked()) >= 1 ? 0 : 1),
  };

  graph: StationApi["graph"] = {
    normalizeSignal: (message) => {
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
    },
    promptBuffer: async (tenantId) => this.promptByTenant.get(tenantId) ?? "",
    commitSend: async (input) => {
      this.sendIds.add(input.sendId);
      await this.callProvider(input.sendId, false);
      return { sendId: input.sendId };
    },
    sendFromAuthFailure: async (status) => {
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
    },
    startWithoutGraphConfig: async () => {
      throw new StationError({
        code: "config.graph_required",
        message: "Graph config required for O365",
      });
    },
    approveOnce: async () => {
      const receipt = await this.send.approve("dec-1");
      return { providerCalls: this.providerCalls.get(receipt.sendId) ?? 0 };
    },
  };

  private requireDecision(id: string): Decision {
    const row = this.decisions.get(id);
    if (!row) {
      throw new StationError({
        code: "invariant.unhandled",
        message: `unknown decision ${id}`,
      });
    }
    return row;
  }

  private async callProvider(sendId: string, force: boolean): Promise<void> {
    const current = this.providerCalls.get(sendId) ?? 0;
    if (!force && current > 0) {
      return;
    }
    this.providerCalls.set(sendId, current + 1);
  }

  private async handleWorker(
    req: Parameters<Parameters<typeof createServer>[0]>[0],
    res: Parameters<Parameters<typeof createServer>[0]>[1],
    log: Logger,
  ): Promise<void> {
    const requestId = randomUUID();
    const url = req.url ?? "/";
    const write = (status: number, body: unknown): void => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };
    try {
      await runWithContext({ requestId, log }, async () => {
        if (url.startsWith("/health")) {
          write(200, { ok: true });
          return;
        }
        const auth = String(req.headers.authorization ?? "");
        log.info("request", { path: url, authorization: auth });
        if (!auth || auth !== `Bearer ${this.workerToken}`) {
          write(
            401,
            toClientError(
              new StationError({
                code: "auth.control_token",
                message: "control token required",
                requestId,
              }),
            ),
          );
          return;
        }
        if (url.startsWith("/__boom")) {
          throw "boom";
        }
        if (url.startsWith("/park")) {
          const listed = await this.cockpit.parkList({ host: "127.0.0.1" });
          write(listed.status, listed.json);
          return;
        }
        write(404, { error: { code: "invariant.unhandled", requestId } });
      });
    } catch (err) {
      if (err instanceof StationError) {
        write(err.status, toClientError(err));
        return;
      }
      const mapped = new StationError({
        code: "invariant.unhandled",
        message: "unhandled error",
        requestId,
        cause: err,
      });
      write(500, toClientError(mapped));
    }
  }
}

export function getStation(): StationApi {
  return new Station();
}


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
import { getPack, listPackIds, type PackScore, type PackSignal } from "@station/packs";
import {
  runLiveTurn,
  runScoringTurn,
  scoringTurnCallsCommitSend,
  type LiveToolTrace,
} from "@station/loop";
import { mailboxesFromConfig, normalizeGraphMessage, queryPackSql, vaultSearch } from "@station/channels";
import { catalogEquals } from "./catalog.ts";
import { approveWithConnection, ConnectionStore, handleVaultRequest } from "./connections.ts";
import { NANGO_WEBHOOK_MAX_BYTES } from "./nango.ts";
import { fixtureInbound, inboundDecisionId, type ProducedEmail } from "./email-producer.ts";
import { WorkflowDesk, type GmailMailbox, type MailHit } from "./workflow.ts";
import { CONFIG_READ_KEYS } from "./keys.ts";
import { stationConfig } from "./station-config.ts";
import { getSharedLedger } from "./ledger.ts";
import { flushLedgerToSql, hydrateLedgerFromSql } from "./persist-sql.ts";
import { applyLedgerMigration } from "./postgres.ts";
import { KitLedger, type KitDecisionRef } from "./kit-ledger.ts";
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
  from?: string;
  subject?: string;
  amount?: number;
  rationale?: string;
  account?: string;
  kind?: "email" | "slack" | "obsidian" | "db" | "mcp";
  sendTo?: string;
  runId?: string;
  mailboxId?: string;
  threadId?: string;
  producerRef?: string;
  killed?: boolean;
  killPhase?: "unsent" | "inflight" | "sent";
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
const LEDGER_TABLES = [
  "signals",
  "claims",
  "leases",
  "decisions",
  "connections",
  "outbox",
  "waits",
  "records",
];
const CHECKPOINTER_TABLES = ["da_checkpoints", "da_writes"];

function assertNever(value: never): never {
  throw new StationError({
    code: "invariant.unhandled",
    message: `unhandled state ${String(value)}`,
  });
}

function isPreProvider(err: unknown): boolean {
  return (
    err instanceof StationError &&
    (err.code === "connections.missing" ||
      err.code === "connections.needs_reauth" ||
      err.code === "connections.invalid")
  );
}

function beforePark(body: string): string {
  return body.replace(/50%/gi, "5%").replace(/below floor/gi, "at floor");
}

function draftBody(packId: string, signal: unknown, scores: unknown): string {
  const pack = getPack(packId);
  const list = Array.isArray(scores) ? (scores as PackScore[]) : pack.score(signal as PackSignal);
  return pack.draft(signal as PackSignal, list);
}

function isLocalHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function vaultMutationArmsProducers(path: string, method: string): boolean {
  if (method !== "POST") {
    return false;
  }
  if (path === "/nango/complete" || path === "/nango/import" || path === "/nango/webhook") {
    return true;
  }
  if (path === "/connections") {
    return true;
  }
  return /^\/connections\/[^/]+\/test$/.test(path);
}

export class Station implements StationApi {
  private migrated = false;
  private env: Record<string, string | undefined> = {};
  private seedTestRows: boolean;
  private signals = new Map<string, Signal>();
  private claims = new Map<string, string>();
  private leases = new Map<string, Lease>();
  private decisions = new Map<string, Decision>();
  private sendIds = new Set<string>();
  private providerCalls = new Map<string, number>();
  private producerStarts = new Map<string, number>();
  private producerTicks = new Map<string, number>();
  private pollers = new Map<string, ReturnType<typeof setInterval>>();
  private promptByTenant = new Map<string, string>();
  private approveLogLines: string[] = [];
  private workerLogs: string[] = [];
  private workerToken = "station-control";
  private latestPackId = "sales";
  private claimChain: Promise<unknown> = Promise.resolve();
  private approveLocks = new Map<string, Promise<void>>();
  private readonly connectionStore = new ConnectionStore(() => this.env);
  private readonly kitLedger = new KitLedger();
  private readonly workflows = new WorkflowDesk();
  private workflowTimer: ReturnType<typeof setInterval> | null = null;
  private lastTraces: LiveToolTrace[] = [];

  constructor(opts?: { seed?: boolean }) {
    this.seedTestRows = opts?.seed ?? true;
    if (this.seedTestRows) {
      this.seed();
    }
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
    seedDec("dec-missing-box", "parked", "send-missing-box");
    seedDec("dec-sent", "sent", "send-sent");
    const parked = this.decisions.get("dec-parked");
    if (parked) {
      parked.account = "work@acme.com";
      parked.kind = "email";
    }
    const missing = this.decisions.get("dec-missing-box");
    if (missing) {
      missing.account = "gone@acme.com";
      missing.kind = "email";
    }
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
      await applyLedgerMigration(url);
      const shared = getSharedLedger(url);
      if (shared) {
        await hydrateLedgerFromSql(url, shared);
      }
      this.attachLedger();
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
          from?: string;
          subject?: string;
          amount?: number;
          rationale?: string;
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
          existing.body = row.text ?? existing.body;
          existing.from = row.from ?? existing.from;
          existing.subject = row.subject ?? existing.subject;
          existing.amount = row.amount ?? existing.amount;
          existing.rationale = row.rationale ?? existing.rationale;
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
          from: row.from,
          subject: row.subject,
          amount: row.amount,
          rationale: row.rationale,
        });
        this.sendIds.add(`send-${row.fixtureId}`);
      }
      await this.persistLedger();
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
      this.attachLedger();
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
        server.listen({ host: "127.0.0.1", port: opts.port ?? 0 }, resolve);
      });
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      this.runBootScan();
      this.workflowTimer = setInterval(() => {
        void this.runDueWorkflows();
      }, 15_000);
      return {
        port,
        close: () =>
          new Promise<void>((resolve, reject) => {
            if (this.workflowTimer) {
              clearInterval(this.workflowTimer);
              this.workflowTimer = null;
            }
            this.stopPollers();
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
        if (opts.body) {
          req.end(opts.body);
        } else {
          req.end();
        }
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
        await this.pollProducer(producerRef);
        this.armPoller(producerRef);
        return { started: true };
      };
      const pending = this.claimChain.then(run, run);
      this.claimChain = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
    startLiveProducers: async (workerId) => {
      const live = this.connectionStore
        .list()
        .filter((row) => (row.kind === "email" || row.kind === "slack") && row.status === "live");
      const cap = stationConfig.mailProducerCap;
      const running = [...this.producerStarts.values()].filter((count) => count > 0).length;
      let started = 0;
      let skipped = 0;
      for (const row of live) {
        const producerRef = `${row.kind}:${row.account}`;
        if ((this.producerStarts.get(producerRef) ?? 0) > 0) {
          continue;
        }
        if (running + started >= cap) {
          skipped += 1;
          continue;
        }
        try {
          const result = await this.worker.startProducer(producerRef, workerId);
          if (result.started) {
            started += 1;
          }
        } catch {
          // one mailbox must not take the others down
        }
      }
      return { started, skipped };
    },
    producerStartCount: async (producerRef) =>
      this.producerStarts.get(producerRef) ?? 0,
    producerTickCount: async (producerRef) =>
      this.producerTicks.get(producerRef) ?? 0,
    lastLiveTraces: async () => this.lastTraces,
  };

    send: StationApi["send"] = {
    approve: (decisionId) =>
      this.lockApprove(decisionId, async () => {
        const row = this.requireDecision(decisionId);
        const existing = this.kitLedger.outboxFor(decisionId);
        if (row.killed || existing?.state === "killed") {
          throw new StationError({
            code: "send.killed",
            message: "decision is killed",
          });
        }
        if (existing?.state === "sent") {
          return { sendId: existing.sendId, providerMessageId: existing.receipt ?? undefined };
        }
        if (existing?.state === "parked_failed") {
          throw new StationError({
            code: "send.already_attempted",
            message: "send already attempted",
          });
        }
        if (existing?.state === "queued") {
          if (existing.receipt) {
            this.runBootScan();
            const again = this.kitLedger.outboxFor(decisionId);
            if (again?.state === "sent") {
              return { sendId: again.sendId, providerMessageId: again.receipt ?? undefined };
            }
          }
          throw new StationError({
            code: "send.in_flight",
            message: "send is in flight",
          });
        }
        if (existing) {
          return assertNever(existing.state);
        }
        if (row.state === "sent") {
          return { sendId: row.sendId };
        }
        if (row.state === "dropped") {
          throw new StationError({
            code: "send.already_sent",
            message: "decision is dropped",
          });
        }
        if (row.state === "sending") {
          throw new StationError({
            code: "send.in_flight",
            message: "send is in flight",
          });
        }
        this.ensureRun(row);
        const log = createLogger({
          service: "worker",
          write: (line) => this.approveLogLines.push(line),
        }).withContext({ requestId: `approve-${decisionId}` });
        log.info("approve", { decisionId });
        this.kitLedger.insertQueued(this.kitRef(row));
        row.state = "sending";
        await this.persistLedger();
        try {
          if (this.kitLedger.consumeFail(row.id)) {
            await this.callProvider(row.sendId, false);
            this.kitLedger.markFailed(row.sendId);
            row.state = "parked";
            await this.persistLedger();
            throw new StationError({
              code: "send.provider_failed",
              message: "provider failed",
            });
          }
          await approveWithConnection(this.connectionStore, {
            account: row.account,
            body: row.body,
            sendTo: row.sendTo,
          });
        } catch (err) {
          if (err instanceof StationError && err.code === "send.provider_failed") {
            throw err;
          }
          if (isPreProvider(err)) {
            this.kitLedger.rollbackQueued(row.sendId);
            row.state = "parked";
            await this.persistLedger();
            throw err;
          }
          await this.callProvider(row.sendId, false);
          this.kitLedger.markFailed(row.sendId);
          row.state = "parked";
          await this.persistLedger();
          throw new StationError({
            code: "send.provider_failed",
            message: "provider failed",
            cause: err,
          });
        }
        await this.callProvider(row.sendId, false);
        this.kitLedger.markAttempted(row.sendId);
        if (this.kitLedger.consumeCrash(row.id)) {
          await this.persistLedger();
          throw new StationError({
            code: "send.in_flight",
            message: "crashed before receipt",
          });
        }
        if (row.killed) {
          return { sendId: row.sendId };
        }
        const receipt = `msg-${row.sendId}`;
        this.kitLedger.storeReceipt(row.sendId, receipt, this.kitLedger.providerThread(row.id), false);
        const committed = this.kitLedger.commitSent(this.kitRef(row));
        row.state = "sent";
        await this.persistLedger();
        if (committed === "conflict") {
          throw new StationError({
            code: "run.wait_conflict",
            message: "open reply wait exists",
          });
        }
        return { sendId: row.sendId, providerMessageId: receipt };
      }),
    commitSend: async (input) => {
      if (input.fail) {
        throw new StationError({
          code: "send.provider_failed",
          message: "provider failed",
        });
      }
      return { sendId: input.sendId };
    },
    kill: async (decisionId) => {
      const row = this.requireDecision(decisionId);
      const existing = this.kitLedger.outboxFor(decisionId);
      if (row.state === "sent" || existing?.state === "sent") {
        row.killPhase = "sent";
      } else if (row.state === "sending" || existing?.state === "queued") {
        row.killPhase = "inflight";
      } else {
        row.killPhase = "unsent";
      }
      row.killed = true;
      row.state = "dropped";
      this.kitLedger.kill(row.id, row.runId);
      if (row.producerRef) {
        this.leases.delete(row.producerRef);
      }
      await this.persistLedger();
    },
    edit: async (decisionId, body) => {
      const row = this.requireDecision(decisionId);
      const existing = this.kitLedger.outboxFor(decisionId);
      if (existing) {
        throw new StationError({
          code: existing.state === "killed" ? "send.killed" : existing.state === "queued" ? "send.in_flight" : "send.already_attempted",
          message: "edit is closed",
        });
      }
      row.body = beforePark(body);
      row.state = "parked";
      await this.persistLedger();
      return { state: row.state, body: row.body };
    },
    decisionState: async (decisionId) => this.requireDecision(decisionId).state,
    providerCallCount: async (sendId) => this.providerCalls.get(sendId) ?? 0,
    approveLogs: async () => [...this.approveLogLines],
    scoringTurnCallsCommitSend: async () => scoringTurnCallsCommitSend(),
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
      const items = [...this.decisions.values()].map((row) => ({
        id: row.id,
        state: row.state,
        actions: this.parkActions(row),
        runId: row.runId ?? null,
        wait: this.waitView(row),
        outbox: this.outboxView(row),
        tenantId: row.tenantId,
        packId: row.packId,
        body: row.body,
        from: row.from,
        subject: row.subject,
        amount: row.amount,
        rationale: row.rationale,
        channel: (row.kind ?? "email") as "email",
        accountId: row.account ?? stationConfig.email[0]?.id,
        killPhase: row.killPhase ?? null,
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
    rescore: async (signalIds, packId) => {
      getPack(packId);
      this.latestPackId = packId;
      for (const row of this.decisions.values()) {
        const signal = this.signals.get(row.signalId ?? row.id);
        const turn = runScoringTurn(packId, {
          fixtureId: signal?.fixtureId ?? row.id,
          text: signal?.text ?? row.body,
          tenantId: row.tenantId,
          from: row.from,
          subject: row.subject,
          amount: row.amount,
        });
        row.packId = packId;
        row.body = turn.body;
        if (signalIds.includes(row.signalId ?? "") || signalIds.includes(row.id)) {
          row.state = turn.state === "dropped" ? "dropped" : "parked";
        }
      }
      return { packId };
    },
    composeSmokeExit: async () => ((await this.schema.countParked()) >= 1 ? 0 : 1),
  };

  graph: StationApi["graph"] = {
    normalizeSignal: (message) => normalizeGraphMessage(message),
    promptBuffer: async (tenantId) => this.promptByTenant.get(tenantId) ?? "",
    commitSend: async (input) => {
      this.sendIds.add(input.sendId);
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

  kit: StationApi["kit"] = {
    parkInbound: async (input) => {
      const sendId = `send-${input.id}`;
      const runId = randomUUID();
      this.decisions.set(input.id, {
        id: input.id,
        sendId,
        state: "parked",
        body: input.body,
        tenantId: input.tenantId,
        packId: "sales",
        runId,
        mailboxId: input.mailboxId,
        threadId: input.threadId,
        producerRef: input.producerRef,
        killed: false,
      });
      this.sendIds.add(sendId);
      return { decisionId: input.id, runId, sendId };
    },
    outbox: async (decisionId) => {
      const row = this.kitLedger.outboxFor(decisionId);
      if (!row) {
        return null;
      }
      return {
        sendId: row.sendId,
        runId: row.runId,
        decisionId: row.decisionId,
        state: row.state,
        attempts: row.attempts,
        receipt: row.receipt,
      };
    },
    waits: async (runId) => this.kitLedger.waitsFor(runId),
    bootScan: async () => this.runBootScan(),
    postReceipt: async (decisionId, input) => {
      const row = this.requireDecision(decisionId);
      if (!input.receipt) {
        throw new StationError({
          code: "invariant.unhandled",
          message: "receipt is required",
        });
      }
      if (row.killed) {
        throw new StationError({
          code: "send.killed",
          message: "decision is killed",
        });
      }
      const stored = this.kitLedger.storeReceipt(
        row.sendId,
        input.receipt,
        input.threadId ?? null,
        row.killed === true,
      );
      if (!stored) {
        throw new StationError({
          code: "send.killed",
          message: "decision is killed",
        });
      }
      await this.persistLedger();
    },
    readContext: async (tenantId) => this.kitLedger.readRecords(tenantId),
    writeContext: async (input) => {
      this.kitLedger.writeRecord(input);
      await this.persistLedger();
    },
    armCrash: async (decisionId, _point) => {
      this.kitLedger.armCrash(decisionId);
    },
    armProviderFailure: async (decisionId) => {
      this.kitLedger.armFail(decisionId);
    },
    armProviderThread: async (decisionId, threadId) => {
      this.kitLedger.armThread(decisionId, threadId);
    },
    resumeReply: async (input) => {
      const wait = this.kitLedger.resume(input.mailboxId, input.threadId);
      if (!wait) {
        throw new StationError({
          code: "invariant.unhandled",
          message: "no open reply wait",
        });
      }
      const decisionId = `reply-${randomUUID()}`;
      const sendId = `send-${decisionId}`;
      this.decisions.set(decisionId, {
        id: decisionId,
        sendId,
        state: "parked",
        body: input.body,
        tenantId: wait.tenantId,
        packId: "sales",
        runId: wait.runId,
        mailboxId: input.mailboxId,
        threadId: input.threadId,
        killed: false,
      });
      this.sendIds.add(sendId);
      return { runId: wait.runId, decisionId };
    },
    settleInFlight: async (decisionId, input) => {
      const row = this.requireDecision(decisionId);
      const existing = this.kitLedger.outboxFor(decisionId);
      if (!existing || existing.state !== "queued" || row.killed) {
        return;
      }
      this.ensureRun(row);
      const stored = this.kitLedger.storeReceipt(
        row.sendId,
        input.receipt,
        input.threadId ?? null,
        row.killed === true,
      );
      if (!stored) {
        return;
      }
      const committed = this.kitLedger.commitSent(this.kitRef(row));
      if (committed === "skipped") {
        return;
      }
      row.state = "sent";
    },
    insertTimer: async (input) => {
      this.kitLedger.insertTimer(input);
    },
    wakeDueTimers: async (now) => {
      const due = this.kitLedger.takeDue(now);
      const first = due[0];
      if (!first) {
        throw new StationError({
          code: "invariant.unhandled",
          message: "no timer is due",
        });
      }
      const decisionId = `timer-${randomUUID()}`;
      const sendId = `send-${decisionId}`;
      this.decisions.set(decisionId, {
        id: decisionId,
        sendId,
        state: "parked",
        body: "timer draft",
        tenantId: first.tenantId,
        packId: "sales",
        runId: first.runId,
        mailboxId: first.mailboxId,
        threadId: first.threadId,
        killed: false,
      });
      this.sendIds.add(sendId);
      return { decisionId, runId: first.runId };
    },
  };

  private pollMs(): number {
    const raw = Number(this.env.STATION_POLL_MS ?? 30_000);
    return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
  }

  private async pollProducer(producerRef: string): Promise<void> {
    const email = producerRef.startsWith("email:");
    const slack = producerRef.startsWith("slack:");
    if (!email && !slack) {
      this.producerTicks.set(producerRef, (this.producerTicks.get(producerRef) ?? 0) + 1);
      return;
    }
    const kind = email ? "email" : "slack";
    const account = producerRef.slice(`${kind}:`.length);
    const produced = await this.connectionStore.pollAccount(account, kind);
    for (const msg of produced) {
      this.parkProduced(msg);
    }
    this.runBootScan();
    this.producerTicks.set(producerRef, (this.producerTicks.get(producerRef) ?? 0) + 1);
  }

  private armPoller(producerRef: string): void {
    if (this.pollers.has(producerRef)) {
      return;
    }
    const timer = setInterval(() => {
      void this.pollProducer(producerRef).catch(() => undefined);
    }, this.pollMs());
    this.pollers.set(producerRef, timer);
  }

  private activityRows(): Array<{
    id: string;
    action: string;
    account: string;
    detail: string;
    channel: string;
    killPhase?: "unsent" | "inflight" | "sent";
  }> {
    return [...this.decisions.values()].map((row) => ({
      id: `decision-${row.id}`,
      action: row.state,
      killPhase: row.killPhase,
      account: row.account ?? row.tenantId,
      detail: row.subject ?? row.body ?? row.id,
      channel: row.kind ?? "email",
    }));
  }

  private briefText(query: string): string {
    const rows = this.activityRows();
    const parked = [...this.decisions.values()].filter((row) => row.state === "parked");
    const needle = query.trim().toLowerCase();
    const hits = needle
      ? rows.filter((row) => `${row.detail} ${row.account} ${row.action}`.toLowerCase().includes(needle))
      : rows;
    return [
      "Workspace brief",
      query ? `Query “${query}” hit ${hits.length} ledger rows.` : "No query. Whole workspace.",
      `${parked.length} waiting on a human.`,
      hits[0]?.detail ?? "none",
    ].join("\n");
  }

  private stopPollers(): void {
    for (const timer of this.pollers.values()) {
      clearInterval(timer);
    }
    this.pollers.clear();
    for (const producerRef of this.producerStarts.keys()) {
      const lease = this.leases.get(producerRef);
      if (lease) {
        lease.heartbeatAt = Date.now() - 31_000;
      }
    }
  }

  private async persistLedger(): Promise<void> {
    const url = this.env.STATION_DATABASE_URL;
    const shared = getSharedLedger(url);
    if (!url || !shared) {
      return;
    }
    await flushLedgerToSql(url, shared);
  }

  private attachLedger(): void {
    const shared = getSharedLedger(this.env.STATION_DATABASE_URL);
    if (!shared) {
      return;
    }
    if (shared.decisions.size === 0) {
      for (const [id, row] of this.decisions) {
        shared.decisions.set(id, row);
      }
      for (const [id, row] of this.signals) {
        shared.signals.set(id, row);
      }
      for (const [id, row] of this.claims) {
        shared.claims.set(id, row);
      }
      for (const [id, row] of this.leases) {
        shared.leases.set(id, row);
      }
      for (const sendId of this.sendIds) {
        shared.sendIds.add(sendId);
      }
    }
    this.decisions = shared.decisions;
    this.signals = shared.signals;
    this.claims = shared.claims;
    this.leases = shared.leases;
    this.sendIds = shared.sendIds;
    this.kitLedger.attach(shared);
  }

  private gmailMailboxes(): GmailMailbox[] {
    const boxes: GmailMailbox[] = [];
    for (const row of this.connectionStore.list()) {
      if (row.kind !== "email" || row.status !== "live") {
        continue;
      }
      const stored = this.connectionStore.find("email", row.account);
      if (!stored) {
        continue;
      }
      const fields = JSON.parse(this.connectionStore.decryptRow(stored)) as {
        provider?: string;
        refreshToken?: string;
        accessToken?: string;
        expiresAt?: string;
      };
      if (fields.provider !== "gmail" || !fields.refreshToken) {
        continue;
      }
      boxes.push({
        account: row.account,
        refreshToken: fields.refreshToken,
        accessToken: fields.accessToken ?? "",
        expiresAt: fields.expiresAt ?? "",
      });
    }
    return boxes;
  }

  private parkWorkflowHits(hits: MailHit[]): void {
    for (const hit of hits) {
      const id = `thread-${hit.account}-${hit.threadId}`;
      if (this.decisions.has(id)) {
        continue;
      }
      const address = hit.from.match(/<([^>]+)>/)?.[1] ?? hit.from;
      this.decisions.set(id, {
        id,
        sendId: `send-${id}`,
        state: "parked",
        body: hit.draft,
        tenantId: hit.account,
        packId: this.latestPackId,
        account: hit.account,
        kind: "email",
        sendTo: address,
        from: hit.from,
        subject: hit.subject.startsWith("Re:") ? hit.subject : `Re: ${hit.subject}`,
        rationale: hit.thread,
      });
      this.sendIds.add(`send-${id}`);
    }
    void this.persistLedger();
  }

  private async runDueWorkflows(): Promise<void> {
    const runs = await this.workflows.tick(Date.now(), {
      mailboxes: this.gmailMailboxes(),
      fetchImpl: fetch,
      env: this.env,
    });
    for (const run of runs) {
      this.parkWorkflowHits(run.needsAction);
    }
  }

  private parkProduced(msg: ProducedEmail): void {
    const id = inboundDecisionId(msg);
    if (this.decisions.has(id)) {
      return;
    }
    const signal = {
      fixtureId: id,
      tenantId: msg.account,
      from: msg.from,
      subject: msg.subject,
      text: msg.body,
    };
    const turn = runLiveTurn(this.latestPackId, signal, {
      modelKey: this.env.STATION_MODEL_KEY,
      adapters: {
        ledgerHits: [...this.decisions.values()].map((row) => ({
          tenantId: row.tenantId,
          text: row.subject ?? row.body ?? row.id,
        })),
        queryDb: () =>
          queryPackSql(
            this.env.PACK_DATABASE_URL ?? "postgres://pack/db",
            this.env.STATION_DATABASE_URL ?? "postgres://station/db",
            "select 1",
          ),
        vaultSearch: (needle) => {
          const root = this.env.STATION_VAULT_ROOT;
          if (!root || !existsSync(root)) {
            return [];
          }
          return vaultSearch(root, needle);
        },
      },
    });
    this.lastTraces = turn.traces ?? [];
    const state = turn.state === "dropped" ? "dropped" : "parked";
    this.decisions.set(id, {
      id,
      sendId: `send-${id}`,
      state,
      body: turn.body,
      tenantId: msg.account,
      packId: this.latestPackId,
      account: msg.account,
      kind: msg.kind,
      sendTo: msg.sendTo,
      from: msg.from,
      subject: msg.subject,
      rationale: turn.state,
    });
    this.sendIds.add(`send-${id}`);
    void this.persistLedger();
  }

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

  private ensureRun(row: Decision): void {
    if (!row.runId) {
      row.runId = randomUUID();
    }
    if (!row.mailboxId) {
      row.mailboxId = row.account ?? `box-${row.id}`;
    }
    if (!row.threadId) {
      row.threadId = `thread-${row.id}`;
    }
  }

  private kitRef(row: Decision): KitDecisionRef {
    this.ensureRun(row);
    return {
      id: row.id,
      sendId: row.sendId,
      runId: row.runId ?? "",
      tenantId: row.tenantId,
      mailboxId: row.mailboxId ?? "",
      threadId: row.threadId ?? "",
      killed: row.killed === true,
    };
  }

  private parkActions(row: Decision): ParkItem["actions"] {
    if (row.state === "parked") {
      return ["Approve", "Edit", "Kill"];
    }
    if (row.state === "sending") {
      return ["Kill"];
    }
    return [];
  }

  private outboxView(row: Decision): { sendId: string; state: string; attempts: number } | null {
    const outbox = this.kitLedger.outboxFor(row.id);
    if (!outbox) {
      return null;
    }
    return { sendId: outbox.sendId, state: outbox.state, attempts: outbox.attempts };
  }

  private waitView(row: Decision): { state: string; reason: string; wakeAt: string | null } | null {
    if (!row.runId) {
      return null;
    }
    const open = this.kitLedger.waitsFor(row.runId).find((wait) => wait.state === "open");
    if (!open) {
      return null;
    }
    return { state: open.state, reason: open.reason, wakeAt: open.wakeAt };
  }

  private runBootScan(): { warned: string[]; completed: string[] } {
    const scan = this.kitLedger.bootScan((decisionId) => {
      const row = this.decisions.get(decisionId);
      if (!row) {
        return null;
      }
      return this.kitRef(row);
    });
    for (const item of scan.completed) {
      const row = this.decisions.get(item.decisionId);
      if (row && !row.killed) {
        row.state = "sent";
      }
    }
    if (scan.warned.length > 0) {
      const log = createLogger({
        service: "worker",
        write: (line) => this.workerLogs.push(line),
      }).withContext({ requestId: "boot-scan" });
      log.warn("send.in_flight", { sendIds: scan.warned.length });
    }
    return { warned: scan.warned, completed: scan.completed.map((item) => item.sendId) };
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
    const parsed = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = parsed.pathname;
    const write = (status: number, body: unknown): void => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };
    const redirect = (status: number, location: string): void => {
      res.statusCode = status;
      res.setHeader("location", location);
      res.end();
    };
    try {
      await runWithContext({ requestId, log }, async () => {
        if (path.startsWith("/health")) {
          write(200, { ok: true });
          return;
        }
        const auth = String(req.headers.authorization ?? "");
        log.info("request", { path, authorization: auth });
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
        if (path.startsWith("/__boom")) {
          throw "boom";
        }
        const rawBody =
          req.method === "POST" || req.method === "PUT" || req.method === "PATCH"
            ? await readRequestBody(req, path === "/nango/webhook" ? NANGO_WEBHOOK_MAX_BYTES : 1_048_576)
            : "";
        if (
          await handleVaultRequest({
            path,
            method: req.method ?? "GET",
            url: parsed,
            body: rawBody,
            store: this.connectionStore,
            env: this.env,
            write,
            redirect,
            headers: {
              "x-nango-hmac-sha256": headerValue(req.headers, "x-nango-hmac-sha256"),
            },
          })
        ) {
          await this.persistLedger();
          if (vaultMutationArmsProducers(path, req.method ?? "GET")) {
            await this.worker.startLiveProducers("connect");
          }
          return;
        }
        const receiptPost = path.match(/^\/park\/([^/]+)\/receipt$/);
        if (receiptPost && req.method === "POST") {
          const decisionId = decodeURIComponent(receiptPost[1] ?? "");
          let parsedBody: { receipt?: string; threadId?: string } = {};
          try {
            parsedBody = JSON.parse(rawBody || "{}") as { receipt?: string; threadId?: string };
          } catch {
            throw new StationError({
              code: "invariant.unhandled",
              message: "receipt body is not json",
            });
          }
          await this.kit.postReceipt(decisionId, {
            receipt: parsedBody.receipt ?? "",
            threadId: parsedBody.threadId,
          });
          write(200, { ok: true });
          return;
        }
        const parkAction = path.match(/^\/park\/([^/]+)\/(approve|edit|kill)/);
        if (parkAction && req.method === "POST") {
          const decisionId = decodeURIComponent(parkAction[1] ?? "");
          const action = parkAction[2];
          if (action === "approve") {
            const receipt = await this.send.approve(decisionId);
            write(200, { sendId: receipt.sendId, state: "sent" });
            return;
          }
          if (action === "kill") {
            await this.send.kill(decisionId);
            write(200, { state: "dropped" });
            return;
          }
          if (action === "edit") {
            const parsedBody = JSON.parse(rawBody || "{}") as { body?: string };
            const edited = await this.send.edit(decisionId, parsedBody.body ?? "");
            write(200, edited);
            return;
          }
        }
        if (path === "/workflows" && req.method === "GET") {
          write(200, { items: this.workflows.list(), latest: this.workflows.latest() });
          return;
        }
        if (path === "/workflows" && req.method === "POST") {
          const body = JSON.parse(rawBody || "{}") as {
            name?: string;
            days?: number;
            webhookUrl?: string;
            everyMs?: number;
          };
          const saved = this.workflows.define({
            id: randomUUID(),
            name: body.name?.trim() || "Mail scan",
            days: body.days && body.days > 0 ? body.days : 3,
            webhookUrl: body.webhookUrl?.trim() ?? "",
            everyMs: body.everyMs && body.everyMs > 0 ? body.everyMs : null,
          });
          write(200, saved);
          return;
        }
        if (path === "/workflows/chat" && req.method === "POST") {
          const body = JSON.parse(rawBody || "{}") as { text?: string };
          const run = await this.workflows.runChat(body.text ?? "", {
            mailboxes: this.gmailMailboxes(),
            fetchImpl: fetch,
            env: this.env,
          });
          this.parkWorkflowHits(run.needsAction);
          write(200, run);
          return;
        }
        if (path.startsWith("/activity") && req.method === "GET") {
          write(200, { items: this.activityRows() });
          return;
        }
        if (path.startsWith("/brief") && req.method === "GET") {
          const query = parsed.searchParams.get("q") ?? "";
          write(200, { brief: this.briefText(query) });
          return;
        }
        if (path.startsWith("/park")) {
          const listed = await this.cockpit.parkList({ host: "127.0.0.1" });
          write(listed.status, listed.json);
          return;
        }
        if (path.startsWith("/accounts") && req.method === "GET") {
          write(200, { items: mailboxesFromConfig(stationConfig) });
          return;
        }
        if (path.startsWith("/packs") && req.method === "GET") {
          write(200, { items: listPackIds(), active: this.latestPackId });
          return;
        }
        const activate = path.match(/^\/packs\/([^/]+)\/activate/);
        if (activate && req.method === "POST") {
          const packId = decodeURIComponent(activate[1] ?? "sales");
          getPack(packId);
          await this.replay.rescore(
            [...this.decisions.values()].map((row) => row.signalId ?? row.id),
            packId,
          );
          write(200, { packId: this.latestPackId });
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

export function getStation(opts?: { seed?: boolean }): StationApi {
  return new Station(opts);
}

function headerValue(
  headers: Parameters<Parameters<typeof createServer>[0]>[0]["headers"],
  name: string,
): string {
  const raw = headers[name];
  return Array.isArray(raw) ? (raw[0] ?? "") : String(raw ?? "");
}

function readRequestBody(
  req: Parameters<Parameters<typeof createServer>[0]>[0],
  maxBytes: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(err);
    };
    req.on("data", (chunk) => {
      const buf = chunk as Buffer;
      size += buf.length;
      if (size > maxBytes) {
        fail(
          new StationError({
            code: "connections.invalid",
            message: "request body too large",
          }),
        );
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", fail);
  });
}


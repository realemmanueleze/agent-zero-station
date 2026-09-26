import { randomUUID } from "node:crypto";
import { StationError } from "@station/observability";

export type KitOutboxState = "queued" | "sent" | "parked_failed" | "killed";

export type KitOutbox = {
  sendId: string;
  runId: string;
  decisionId: string;
  state: KitOutboxState;
  attempts: number;
  receipt: string | null;
  providerThreadId: string | null;
};

export type KitWait = {
  id: string;
  runId: string;
  tenantId: string;
  mailboxId: string;
  threadId: string;
  reason: "reply" | "timer";
  wakeAt: string | null;
  state: "open" | "dead" | "resumed";
};

export type KitRecord = {
  id: string;
  tenantId: string;
  body: string;
};

export type KitDecisionRef = {
  id: string;
  sendId: string;
  runId: string;
  tenantId: string;
  mailboxId: string;
  threadId: string;
  killed: boolean;
};

export class KitLedger {
  private outbox = new Map<string, KitOutbox>();
  private waits: KitWait[] = [];
  private records: KitRecord[] = [];

  attach(shared: { outbox: Map<string, KitOutbox>; waits: KitWait[]; records: KitRecord[] }): void {
    this.outbox = shared.outbox;
    this.waits = shared.waits;
    this.records = shared.records;
  }
  private readonly crash = new Set<string>();
  private readonly fail = new Set<string>();
  private readonly threads = new Map<string, string>();

  outboxFor(decisionId: string): KitOutbox | null {
    for (const row of this.outbox.values()) {
      if (row.decisionId === decisionId) {
        return { ...row };
      }
    }
    return null;
  }

  waitsFor(runId: string): KitWait[] {
    return this.waits.filter((row) => row.runId === runId).map((row) => ({ ...row }));
  }

  armCrash(decisionId: string): void {
    this.crash.add(decisionId);
  }

  armFail(decisionId: string): void {
    this.fail.add(decisionId);
  }

  armThread(decisionId: string, threadId: string): void {
    this.threads.set(decisionId, threadId);
  }

  consumeCrash(decisionId: string): boolean {
    if (!this.crash.has(decisionId)) {
      return false;
    }
    this.crash.delete(decisionId);
    return true;
  }

  consumeFail(decisionId: string): boolean {
    if (!this.fail.has(decisionId)) {
      return false;
    }
    this.fail.delete(decisionId);
    return true;
  }

  providerThread(decisionId: string): string | null {
    return this.threads.get(decisionId) ?? null;
  }

  insertQueued(input: KitDecisionRef): void {
    if (this.outbox.has(input.sendId)) {
      throw new StationError({
        code: "invariant.unhandled",
        message: "outbox already exists",
      });
    }
    this.outbox.set(input.sendId, {
      sendId: input.sendId,
      runId: input.runId,
      decisionId: input.id,
      state: "queued",
      attempts: 0,
      receipt: null,
      providerThreadId: null,
    });
  }

  rollbackQueued(sendId: string): void {
    const row = this.outbox.get(sendId);
    if (row && row.state === "queued" && row.receipt === null && row.attempts === 0) {
      this.outbox.delete(sendId);
    }
  }

  markAttempted(sendId: string): void {
    const row = this.require(sendId);
    row.attempts = 1;
  }

  markFailed(sendId: string): void {
    const row = this.require(sendId);
    if (row.state === "killed") {
      return;
    }
    row.state = "parked_failed";
    row.attempts = 1;
    row.receipt = null;
  }

  storeReceipt(sendId: string, receipt: string, threadId: string | null, killed: boolean): boolean {
    const row = this.require(sendId);
    if (killed || row.state === "killed") {
      return false;
    }
    if (row.state !== "queued" || row.receipt) {
      throw new StationError({
        code: "send.in_flight",
        message: "receipt is not allowed",
      });
    }
    row.receipt = receipt;
    if (threadId) {
      row.providerThreadId = threadId;
    }
    return true;
  }

  commitSent(input: KitDecisionRef): "ok" | "conflict" | "skipped" {
    const row = this.require(input.sendId);
    if (input.killed || row.state === "killed") {
      return "skipped";
    }
    if (row.state !== "queued" || !row.receipt) {
      throw new StationError({
        code: "send.in_flight",
        message: "receipt is missing",
      });
    }
    row.state = "sent";
    const threadId = row.providerThreadId ?? input.threadId;
    const clash = this.waits.some(
      (wait) =>
        wait.state === "open" &&
        wait.reason === "reply" &&
        wait.mailboxId === input.mailboxId &&
        wait.threadId === threadId,
    );
    if (clash) {
      return "conflict";
    }
    this.waits.push({
      id: randomUUID(),
      runId: input.runId,
      tenantId: input.tenantId,
      mailboxId: input.mailboxId,
      threadId,
      reason: "reply",
      wakeAt: null,
      state: "open",
    });
    return "ok";
  }

  kill(decisionId: string, runId: string | undefined): void {
    for (const row of this.outbox.values()) {
      if (row.decisionId === decisionId) {
        row.state = "killed";
        row.receipt = null;
      }
    }
    if (!runId) {
      return;
    }
    for (const wait of this.waits) {
      if (wait.runId === runId && wait.state === "open") {
        wait.state = "dead";
      }
    }
  }

  bootScan(live: (decisionId: string) => KitDecisionRef | null): {
    warned: string[];
    completed: Array<{ sendId: string; decisionId: string; conflict: boolean }>;
  } {
    const warned: string[] = [];
    const completed: Array<{ sendId: string; decisionId: string; conflict: boolean }> = [];
    for (const row of this.outbox.values()) {
      if (row.state !== "queued") {
        continue;
      }
      if (!row.receipt) {
        warned.push(row.sendId);
        continue;
      }
      const decision = live(row.decisionId);
      if (!decision || decision.killed) {
        continue;
      }
      const result = this.commitSent(decision);
      if (result === "skipped") {
        continue;
      }
      completed.push({
        sendId: row.sendId,
        decisionId: row.decisionId,
        conflict: result === "conflict",
      });
    }
    return { warned, completed };
  }

  findOpenReply(mailboxId: string, threadId: string): KitWait | null {
    return (
      this.waits.find(
        (row) =>
          row.state === "open" &&
          row.reason === "reply" &&
          row.mailboxId === mailboxId &&
          row.threadId === threadId,
      ) ?? null
    );
  }

  resume(mailboxId: string, threadId: string): KitWait | null {
    const wait = this.findOpenReply(mailboxId, threadId);
    if (!wait) {
      return null;
    }
    wait.state = "resumed";
    for (const row of this.waits) {
      if (row.runId === wait.runId && row.reason === "timer" && row.state === "open") {
        row.state = "dead";
      }
    }
    return { ...wait };
  }

  insertTimer(input: {
    runId: string;
    tenantId: string;
    mailboxId: string;
    threadId: string;
    wakeAt: string;
  }): void {
    this.waits.push({
      id: randomUUID(),
      runId: input.runId,
      tenantId: input.tenantId,
      mailboxId: input.mailboxId,
      threadId: input.threadId,
      reason: "timer",
      wakeAt: input.wakeAt,
      state: "open",
    });
  }

  takeDue(now: string): KitWait[] {
    const due = this.waits.filter(
      (row) => row.reason === "timer" && row.state === "open" && row.wakeAt !== null && row.wakeAt <= now,
    );
    for (const row of due) {
      row.state = "dead";
    }
    return due.map((row) => ({ ...row }));
  }

  writeRecord(input: KitRecord): void {
    const index = this.records.findIndex((row) => row.id === input.id);
    if (index >= 0) {
      this.records[index] = { ...input };
      return;
    }
    this.records.push({ ...input });
  }

  readRecords(tenantId: string): KitRecord[] {
    return this.records.filter((row) => row.tenantId === tenantId).map((row) => ({ ...row }));
  }

  private require(sendId: string): KitOutbox {
    const row = this.outbox.get(sendId);
    if (!row) {
      throw new StationError({
        code: "invariant.unhandled",
        message: "unknown outbox",
      });
    }
    return row;
  }
}

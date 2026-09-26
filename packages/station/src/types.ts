export type Receipt = {
  sendId: string;
  providerMessageId?: string;
};

export type EmailPayload = {
  from: string;
  threadId: string;
  subject: string;
  text: string;
  amount?: number;
};

export type ParkAction = "Approve" | "Edit" | "Kill";

export type ParkItem = {
  state: "parked" | "sending" | "sent" | "dropped";
  actions: ParkAction[];
};

export type ReplayCompare = {
  state: string;
  draftBody: string;
  tenantId: string;
};

export type StationApi = {
  schema: {
    migrate: () => Promise<void>;
    migrateAgain: () => Promise<void>;
    upsertSignal: (input: { fixtureId: string; tenantId?: string }) => Promise<void>;
    countSignals: () => Promise<number>;
    claim: (signalId: string, packId: string, workerId: string) => Promise<void>;
    acquireLease: (producerRef: string, workerId: string) => Promise<void>;
    heartbeat: (producerRef: string, workerId: string) => Promise<void>;
    expireLease: (producerRef: string) => Promise<void>;
    insertDecision: (input: { sendId: string }) => Promise<void>;
    transition: (id: string, from: string, to: string) => Promise<number>;
    checkpointerTableNames: () => Promise<string[]>;
    ledgerTableNames: () => Promise<string[]>;
    countParked: () => Promise<number>;
    loadFixtureFile: (path: string) => Promise<void>;
  };
  config: {
    load: (env: Record<string, string | undefined>) => unknown;
    dump: (env: Record<string, string | undefined>) => Record<string, unknown>;
    readKeys: () => string[];
    envExampleKeys: () => string[];
    mcpAllowed: (toolName: string, policy?: { allow?: string[] }) => boolean;
  };
  worker: {
    listen: (opts: { host: string; token: string; port?: number }) => Promise<{
      port: number;
      close: () => Promise<void>;
    }>;
    request: (opts: {
      host: string;
      port: number;
      path: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }) => Promise<{ status: number; json: unknown; logs: string[] }>;
    claimSignal: (signalId: string, packId: string, workerId: string) => Promise<void>;
    startProducer: (producerRef: string, workerId: string) => Promise<{ started: boolean }>;
    startLiveProducers: (workerId: string) => Promise<{ started: number; skipped: number }>;
    producerStartCount: (producerRef: string) => Promise<number>;
    producerTickCount: (producerRef: string) => Promise<number>;
    lastLiveTraces: () => Promise<Array<{ name: string; ok: boolean; detail: string }>>;
  };
  send: {
    approve: (decisionId: string) => Promise<Receipt>;
    commitSend: (input: { sendId: string; fail?: boolean }) => Promise<Receipt>;
    kill: (decisionId: string) => Promise<void>;
    edit: (decisionId: string, body: string) => Promise<{ state: string; body: string }>;
    decisionState: (decisionId: string) => Promise<string>;
    providerCallCount: (sendId: string) => Promise<number>;
    approveLogs: (decisionId: string) => Promise<string[]>;
    scoringTurnCallsCommitSend: () => Promise<boolean>;
  };
  cockpit: {
    parkList: (opts: {
      host: string;
      password?: string;
    }) => Promise<{ status: number; json: unknown }>;
    approveFromBrowser: (decisionId: string) => Promise<{
      browserHtml: string;
      workerAuthorization: string;
      error?: { code?: string; stack?: string };
    }>;
    themeStatus: () => Promise<{
      tokensLoaded: boolean;
      missingStationThemeIsError: boolean;
    }>;
    parkPayload: () => Promise<{ item: ParkItem }>;
  };
  replay: {
    draft: (packId: string, signal: unknown, scores: unknown) => string;
    replayCompare: (fixturePath: string, packId: string) => Promise<ReplayCompare[]>;
    loadFixturesTwice: (path: string) => Promise<number>;
    rescore: (signalIds: string[], packId: string) => Promise<{ packId: string }>;
    composeSmokeExit: () => Promise<number>;
  };
  graph: {
    normalizeSignal: (message: unknown) => EmailPayload;
    promptBuffer: (tenantId: string) => Promise<string>;
    commitSend: (input: { sendId: string }) => Promise<Receipt>;
    sendFromAuthFailure: (status: number) => Promise<never>;
    startWithoutGraphConfig: () => Promise<never>;
    approveOnce: () => Promise<{ providerCalls: number }>;
  };
  kit: {
    parkInbound: (input: {
      id: string;
      tenantId: string;
      mailboxId: string;
      threadId: string;
      body: string;
      producerRef?: string;
      recordId?: string;
    }) => Promise<{ decisionId: string; runId: string; sendId: string }>;
    outbox: (decisionId: string) => Promise<{
      sendId: string;
      runId: string;
      decisionId: string;
      state: "queued" | "sent" | "parked_failed" | "killed";
      attempts: number;
      receipt: string | null;
      recordId: string | null;
    } | null>;
    waits: (runId: string) => Promise<
      Array<{
        runId: string;
        tenantId: string;
        mailboxId: string;
        threadId: string;
        reason: "reply" | "timer";
        wakeAt: string | null;
        state: "open" | "dead" | "resumed";
      }>
    >;
    bootScan: () => Promise<{ warned: string[]; completed: string[] }>;
    postReceipt: (
      decisionId: string,
      input: { receipt: string; threadId?: string },
    ) => Promise<void>;
    readContext: (tenantId: string) => Promise<Array<{ id: string; body: string; kind: string; actor: string }>>;
    linkage: (decisionId: string) => Promise<{ recordId: string; tenantId: string }>;
    fewShot: (input: { tenantId: string; recordId: string }) => Promise<string[]>;
    writeContext: (input: {
      id: string;
      tenantId: string;
      body: string;
      kind: "lead" | "traveler" | "job" | "client";
      actor: string;
    }) => Promise<void>;
    armCrash: (decisionId: string, point: "before-receipt") => Promise<void>;
    armProviderFailure: (decisionId: string) => Promise<void>;
    armProviderThread: (decisionId: string, threadId: string) => Promise<void>;
    resumeReply: (input: {
      mailboxId: string;
      threadId: string;
      body: string;
    }) => Promise<{ runId: string; decisionId: string }>;
    settleInFlight: (
      decisionId: string,
      input: { receipt: string; threadId?: string },
    ) => Promise<void>;
    insertTimer: (input: {
      runId: string;
      tenantId: string;
      mailboxId: string;
      threadId: string;
      wakeAt: string;
    }) => Promise<void>;
    wakeDueTimers: (now: string) => Promise<{ decisionId: string; runId: string }>;
  };
};

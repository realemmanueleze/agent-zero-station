import {
  Annotation,
  Command,
  END,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { getPack } from "@station/packs";
import { LedgerCheckpointer, type DaCheckpoint } from "./ledger-checkpointer.ts";

export type HumanDecision =
  | { action: "approve" }
  | { action: "kill" }
  | { action: "edit"; body: string };

export type WaitEvent =
  | { kind: "reply"; text: string }
  | { kind: "follow_up" }
  | { action: "approve" }
  | { action: "kill" };

type Approval = "pending" | "approved" | "killed";

type RailChannels = {
  runId: string;
  mailboxId: string;
  threadId: string;
  goalStage: string;
  thread: string;
  draft: string;
  approval: Approval;
  sentCount: number;
  reply: string;
  phase: string;
  from: string;
  subject: string;
  trace: string[];
};

const RailState = Annotation.Root({
  runId: Annotation<string>,
  mailboxId: Annotation<string>,
  threadId: Annotation<string>,
  goalStage: Annotation<string>({ reducer: (_left, right) => right, default: () => "intro" }),
  thread: Annotation<string>,
  draft: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  approval: Annotation<Approval>({ reducer: (_left, right) => right, default: () => "pending" }),
  sentCount: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  reply: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  phase: Annotation<string>({ reducer: (_left, right) => right, default: () => "draft" }),
  from: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  subject: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  trace: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

export type RailStart = {
  runId: string;
  mailboxId: string;
  threadId: string;
  thread: string;
  from?: string;
  subject?: string;
  goalStage?: string;
};

export type RailPause = {
  runId: string;
  phase: "human_review" | "wait_for_reply" | "done";
  draft: string;
  sentCount: number;
  from: string;
  subject: string;
  trace: string[];
};

export type RailStore = {
  checkpoints: DaCheckpoint[];
  opens: Map<string, string>;
};

type GraphResult = RailChannels & {
  __interrupt__?: Array<{ value?: { kind?: string; draft?: string } }>;
};

function asPause(runId: string, result: GraphResult): RailPause {
  const hit = result.__interrupt__?.[0]?.value;
  const phase = hit?.kind === "wait_for_reply" ? "wait_for_reply" : hit?.kind === "human_review" ? "human_review" : "done";
  return {
    runId,
    phase,
    draft: hit?.draft ?? result.draft ?? "",
    sentCount: result.sentCount ?? 0,
    from: result.from ?? "",
    subject: result.subject ?? "",
    trace: result.trace ?? [],
  };
}

export class RailEngine {
  readonly checkpointer: LedgerCheckpointer;
  private readonly graph;
  private readonly opens: Map<string, string>;

  constructor(
    private readonly opts: {
      send: (state: { draft: string; threadId: string }) => void | Promise<void>;
      store?: RailStore;
    },
  ) {
    const store = opts.store ?? { checkpoints: [], opens: new Map() };
    this.opens = store.opens;
    this.checkpointer = new LedgerCheckpointer(store.checkpoints);
    const send = this.opts.send;
    const graph = new StateGraph(RailState)
      .addNode("enrich_lead", (state) => ({
        from: state.from,
        subject: state.subject,
        trace: ["enrich_lead"],
      }))
      .addNode("draft_outreach", (state) => {
        const pack = getPack("pack-unseen-engine");
        const signal = { text: state.thread, subject: state.subject, from: state.from };
        return {
          draft: pack.draft(signal, pack.score(signal)),
          approval: "pending" as const,
          phase: "review",
          trace: ["draft_outreach"],
        };
      })
      .addNode("human_review", (state) => {
        const decision = interrupt({ kind: "human_review", draft: state.draft }) as HumanDecision;
        if (decision.action === "edit") {
          return { draft: decision.body, approval: "pending" as const, phase: "review", trace: ["human_review"] };
        }
        if (decision.action === "kill") {
          return { approval: "killed" as const, phase: "done", trace: ["human_review"] };
        }
        return { approval: "approved" as const, phase: "send", trace: ["human_review"] };
      })
      .addNode("send_email", async (state) => {
        if (state.approval !== "approved") {
          return { phase: "done", trace: ["send_email"] };
        }
        await send({ draft: state.draft, threadId: state.threadId });
        return { sentCount: state.sentCount + 1, phase: "waiting", trace: ["send_email"] };
      })
      .addNode("wait_for_reply", (state) => {
        const event = interrupt({
          kind: "wait_for_reply",
          draft: state.draft,
          threadId: state.threadId,
        }) as WaitEvent;
        if ("kind" in event && event.kind === "reply") {
          return { reply: event.text, phase: "triage", trace: ["wait_for_reply"] };
        }
        if ("kind" in event && event.kind === "follow_up") {
          return { phase: "follow_up", trace: ["wait_for_reply"] };
        }
        if ("action" in event && event.action === "kill") {
          return { phase: "done", trace: ["wait_for_reply"] };
        }
        return { phase: "waiting", trace: ["wait_for_reply"] };
      })
      .addNode("draft_follow_up", (state) => {
        const pack = getPack("pack-unseen-engine");
        const signal = { text: "No reply yet.", subject: state.subject || "Follow up", from: state.from };
        return {
          draft: pack.draft(signal, pack.score(signal)),
          approval: "pending" as const,
          phase: "review",
          trace: ["draft_follow_up"],
        };
      })
      .addNode("draft_response", (state) => {
        const pack = getPack("pack-unseen-engine");
        const signal = { text: state.reply, subject: "Reply", from: state.from };
        return {
          draft: `${pack.draft(signal, pack.score(signal))}\n${state.reply}`,
          approval: "pending" as const,
          phase: "review",
          trace: ["draft_response"],
        };
      })
      .addEdge(START, "enrich_lead")
      .addEdge("enrich_lead", "draft_outreach")
      .addEdge("draft_outreach", "human_review")
      .addConditionalEdges("human_review", (state) => {
        if (state.approval === "killed") return END;
        if (state.approval === "approved") return "send_email";
        return "human_review";
      })
      .addEdge("send_email", "wait_for_reply")
      .addConditionalEdges("wait_for_reply", (state) => {
        if (state.phase === "triage") return "draft_response";
        if (state.phase === "follow_up") return "draft_follow_up";
        if (state.phase === "done") return END;
        return "wait_for_reply";
      })
      .addEdge("draft_follow_up", "human_review")
      .addEdge("draft_response", "human_review")
      .compile({ checkpointer: this.checkpointer });
    this.graph = graph;
  }

  async start(input: RailStart): Promise<RailPause> {
    const openKey = `${input.mailboxId}\0${input.threadId}`;
    const existing = this.opens.get(openKey);
    if (existing) {
      return this.pauseFor(existing);
    }
    const result = (await this.graph.invoke(
      {
        runId: input.runId,
        mailboxId: input.mailboxId,
        threadId: input.threadId,
        thread: input.thread,
        from: input.from ?? "",
        subject: input.subject ?? "",
        goalStage: input.goalStage ?? "intro",
      },
      { configurable: { thread_id: input.runId } },
    )) as GraphResult;
    this.opens.set(openKey, input.runId);
    return asPause(input.runId, result);
  }

  has(runId: string): boolean {
    for (const id of this.opens.values()) {
      if (id === runId) {
        return true;
      }
    }
    return false;
  }

  openRun(mailboxId: string, threadId: string): string | undefined {
    return this.opens.get(`${mailboxId}\0${threadId}`);
  }

  async phase(runId: string): Promise<RailPause["phase"]> {
    return (await this.pauseFor(runId)).phase;
  }

  async snapshot(runId: string): Promise<RailPause> {
    return this.pauseFor(runId);
  }

  async resume(runId: string, event: HumanDecision | WaitEvent): Promise<RailPause> {
    const result = (await this.graph.invoke(new Command({ resume: event }), {
      configurable: { thread_id: runId },
    })) as GraphResult;
    return asPause(runId, result);
  }

  private async pauseFor(runId: string): Promise<RailPause> {
    const snap = await this.graph.getState({ configurable: { thread_id: runId } });
    const values = snap.values as GraphResult;
    const tasks = snap.tasks as Array<{ interrupts?: Array<{ value?: { kind?: string; draft?: string } }> }>;
    const hit = tasks.flatMap((task) => task.interrupts ?? [])[0]?.value;
    return asPause(runId, { ...values, __interrupt__: hit ? [{ value: hit }] : undefined });
  }
}

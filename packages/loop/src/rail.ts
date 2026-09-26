import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { getPack } from "@station/packs";

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
});

export type RailStart = {
  runId: string;
  mailboxId: string;
  threadId: string;
  thread: string;
  goalStage?: string;
};

export type RailPause = {
  runId: string;
  phase: "human_review" | "wait_for_reply" | "done";
  draft: string;
  sentCount: number;
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
  };
}

export class RailEngine {
  private readonly graph;

  constructor(private readonly opts: { send: (state: { draft: string; threadId: string }) => void }) {
    const send = this.opts.send;
    const graph = new StateGraph(RailState)
      .addNode("draft_outreach", (state) => {
        const pack = getPack("pack-unseen-engine");
        const signal = { text: state.thread, subject: "Intro", from: "lead@unseen.test" };
        return { draft: pack.draft(signal, pack.score(signal)), approval: "pending" as const, phase: "review" };
      })
      .addNode("human_review", (state) => {
        const decision = interrupt({ kind: "human_review", draft: state.draft }) as HumanDecision;
        if (decision.action === "edit") {
          return { draft: decision.body, approval: "pending" as const, phase: "review" };
        }
        if (decision.action === "kill") {
          return { approval: "killed" as const, phase: "done" };
        }
        return { approval: "approved" as const, phase: "send" };
      })
      .addNode("send_email", (state) => {
        if (state.approval !== "approved") {
          return { phase: "done" };
        }
        send({ draft: state.draft, threadId: state.threadId });
        return { sentCount: state.sentCount + 1, phase: "waiting" };
      })
      .addNode("wait_for_reply", (state) => {
        const event = interrupt({
          kind: "wait_for_reply",
          draft: state.draft,
          threadId: state.threadId,
        }) as WaitEvent;
        if ("kind" in event && event.kind === "reply") {
          return { reply: event.text, phase: "triage" };
        }
        if ("action" in event && event.action === "kill") {
          return { phase: "done" };
        }
        return { phase: "waiting" };
      })
      .addNode("draft_response", (state) => {
        const pack = getPack("pack-unseen-engine");
        const signal = { text: state.reply, subject: "Reply", from: "lead@unseen.test" };
        return {
          draft: `${pack.draft(signal, pack.score(signal))}\n${state.reply}`,
          approval: "pending" as const,
          phase: "review",
        };
      })
      .addEdge(START, "draft_outreach")
      .addEdge("draft_outreach", "human_review")
      .addConditionalEdges("human_review", (state) => {
        if (state.approval === "killed") return END;
        if (state.approval === "approved") return "send_email";
        return "human_review";
      })
      .addEdge("send_email", "wait_for_reply")
      .addConditionalEdges("wait_for_reply", (state) => {
        if (state.phase === "triage") return "draft_response";
        if (state.phase === "done") return END;
        return "wait_for_reply";
      })
      .addEdge("draft_response", "human_review")
      .compile({ checkpointer: new MemorySaver() });
    this.graph = graph;
  }

  async start(input: RailStart): Promise<RailPause> {
    const result = (await this.graph.invoke(
      {
        runId: input.runId,
        mailboxId: input.mailboxId,
        threadId: input.threadId,
        thread: input.thread,
        goalStage: input.goalStage ?? "intro",
      },
      { configurable: { thread_id: input.runId } },
    )) as GraphResult;
    return asPause(input.runId, result);
  }

  async resume(runId: string, event: HumanDecision | WaitEvent): Promise<RailPause> {
    const result = (await this.graph.invoke(new Command({ resume: event }), {
      configurable: { thread_id: runId },
    })) as GraphResult;
    return asPause(runId, result);
  }
}

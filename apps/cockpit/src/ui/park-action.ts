import type { ParkItem } from "./types.ts";

export type ParkAction = "approve" | "edit" | "kill";

export type ParkActionResult = {
  ok: boolean;
  state?: string;
  body?: string;
  notice: string;
};

type ParkResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const ERROR_SENTENCES: Record<string, string> = {
  "send.in_flight": "Send in progress. Do not Approve again.",
  "send.already_attempted": "This send failed. Park a new draft to try again.",
  "send.killed": "Killed. Approve will not send.",
  "send.provider_failed": "The provider refused the send. The slip stays parked.",
  "run.wait_conflict": "Sent. This thread is already being watched.",
};

export function needsYou(item: { state: string }): boolean {
  return item.state === "parked" || item.state === "sending";
}

export function waitingCount(items: Array<{ state: string }>): number {
  return items.filter(needsYou).length;
}

export function sentenceForState(
  action: string,
  killPhase?: ParkItem["killPhase"],
  reply = false,
): string {
  switch (action) {
    case "parked":
      return "Parked.";
    case "sending":
      return "Sending.";
    case "sent":
      return reply ? "Sent. Reply is parked." : "Sent. Watching for a reply.";
    case "dropped":
      if (killPhase === "inflight") {
        return "Killed. If the provider already accepted it, that copy stays out.";
      }
      if (killPhase === "sent") {
        return "Killed. The sent message stays sent.";
      }
      return "Killed. Nothing was sent.";
    default:
      return action;
  }
}

export function replyOnRun(item: ParkItem, rows: ParkItem[]): boolean {
  if (item.state !== "parked" || !item.runId) {
    return false;
  }
  return rows.some((row) => row.id !== item.id && row.runId === item.runId && row.state === "sent");
}

export function ledgerSentence(item: ParkItem, rows: ParkItem[]): string {
  return sentenceForState(item.state, item.killPhase, hasReply(item, rows));
}

function hasReply(item: ParkItem, rows: ParkItem[]): boolean {
  if (item.state !== "sent" || !item.runId) {
    return false;
  }
  return rows.some((row) => row.id !== item.id && row.runId === item.runId && row.state === "parked");
}

export function tickWord(sentence: string): "Parked" | "Sending" | "Sent" | "Killed" | "quiet" {
  if (sentence.startsWith("Parked")) {
    return "Parked";
  }
  if (sentence.startsWith("Sending")) {
    return "Sending";
  }
  if (sentence.startsWith("Sent")) {
    return "Sent";
  }
  if (sentence.startsWith("Killed")) {
    return "Killed";
  }
  return "quiet";
}

export function killPhaseFor(state: string): ParkItem["killPhase"] {
  if (state === "sending") {
    return "inflight";
  }
  if (state === "sent") {
    return "sent";
  }
  return "unsent";
}

function noticeFor(action: ParkAction, state: string, priorState?: string): string {
  switch (action) {
    case "approve":
      return "Sent. Watching for a reply.";
    case "edit":
      return "Draft updated. Still parked.";
    case "kill":
      return sentenceForState("dropped", killPhaseFor(priorState ?? "parked"));
    default: {
      const _never: never = action;
      return String(_never ?? state);
    }
  }
}

export async function interpretParkAction(
  resOrPromise: ParkResponse | Promise<ParkResponse>,
  action: ParkAction,
  priorState?: string,
): Promise<ParkActionResult> {
  try {
    const res = await resOrPromise;
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      return { ok: false, notice: "park.failed: json" };
    }
    const json =
      parsed && typeof parsed === "object"
        ? (parsed as { state?: string; body?: string; error?: { code?: string } })
        : {};
    if (json.error?.code) {
      const code = json.error.code;
      return {
        ok: false,
        state: code === "run.wait_conflict" ? "sent" : undefined,
        notice: ERROR_SENTENCES[code] ?? code,
      };
    }
    if (!res.ok) {
      return { ok: false, notice: `park.failed: ${res.status}` };
    }
    if (!json.state) {
      return { ok: false, notice: "park.invalid: missing state" };
    }
    return {
      ok: true,
      state: json.state,
      body: json.body,
      notice: noticeFor(action, json.state, priorState),
    };
  } catch {
    return { ok: false, notice: "park.failed" };
  }
}

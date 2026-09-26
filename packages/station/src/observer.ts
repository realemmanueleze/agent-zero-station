import { createLogger, StationError } from "@station/observability";

export type ObserverAction = "park" | "escalate";

export type ObserverNote = {
  id: string;
  action: ObserverAction;
  parkId: string;
  reason: string;
  actor: string;
};

const notes = new Map<string, ObserverNote>();
let sequence = 0;

const KNOWN_MODELS = new Set(["station", "frontier"]);

export function observe(input: {
  action: ObserverAction;
  parkId: string;
  reason: string;
  actor: string;
  send: () => void;
  log?: string[];
  fields?: Record<string, unknown>;
}): ObserverNote {
  void input.send;
  const key = `${input.action}\0${input.parkId}\0${input.reason}`;
  const existing = notes.get(key);
  if (existing) {
    return existing;
  }
  sequence += 1;
  const note: ObserverNote = {
    id: `obs-${sequence}`,
    action: input.action,
    parkId: input.parkId,
    reason: input.reason,
    actor: input.actor,
  };
  notes.set(key, note);
  if (input.log) {
    const logger = createLogger({
      service: "observer",
      write: (line) => input.log?.push(line),
    });
    logger.info("observer", input.fields);
  }
  return note;
}

export function noteSpend(input: { spent: number; budget: number; model: string }): {
  warnings: string[];
  blocked: boolean;
  sentence: string;
} {
  if (!KNOWN_MODELS.has(input.model)) {
    throw new StationError({
      code: "spend.unknown_model",
      message: "unknown model",
    });
  }
  const ratio = input.budget === 0 ? 1 : input.spent / input.budget;
  const warnings: string[] = [];
  if (ratio >= 0.5) {
    warnings.push("50");
  }
  if (ratio >= 0.8) {
    warnings.push("80");
  }
  if (input.model === "frontier" && ratio >= 1) {
    throw new StationError({
      code: "spend.blocked",
      message: "frontier budget is spent",
    });
  }
  return { warnings, blocked: false, sentence: spendSentence(input.spent, input.budget) };
}

export function spendSentence(spent: number, budget: number): string {
  return `$${spent} of $${budget}`;
}

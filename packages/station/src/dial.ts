import { StationError } from "@station/observability";

export type Dial = "ask_me" | "just_do" | "never";

export type HoldState = "held" | "cancelled";

export type Hold = {
  id: string;
  state: HoldState;
};

let dial: Dial = "ask_me";
let holds: Hold[] = [];

export function readDial(): Dial {
  return dial;
}

export function setDial(next: Dial): void {
  dial = next;
}

export function toolMayChangeDial(_tool: string): boolean {
  return false;
}

export function applyDial(id: string): "parked" | "held" {
  if (dial === "never") {
    throw new StationError({
      code: "policy.denied",
      message: "dial is never",
    });
  }
  if (dial === "just_do") {
    holdForJustDo(id);
    return "held";
  }
  return "parked";
}

export function holdForJustDo(id: string): void {
  if (!holds.some((row) => row.id === id)) {
    holds.push({ id, state: "held" });
  }
}

export function recheckHold(id: string): HoldState | "parked" {
  const row = holds.find((item) => item.id === id);
  if (!row) {
    return "parked";
  }
  return row.state;
}

export function killHold(id: string): void {
  const row = holds.find((item) => item.id === id);
  if (row) {
    row.state = "cancelled";
  }
}

export function snapshotHolds(): Hold[] {
  return holds.map((row) => ({ ...row }));
}

export function bootHolds(saved: Hold[]): void {
  holds = saved.map((row) => ({ ...row }));
}

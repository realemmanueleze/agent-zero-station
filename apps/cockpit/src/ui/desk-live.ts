import type { LoopStep } from "./types.ts";

export type DeskLive = {
  waiting: number;
  tick: string;
  detail: string;
  steps: LoopStep[];
};

type Listener = (live: DeskLive) => void;
const listeners = new Set<Listener>();

export function publishDesk(live: DeskLive): void {
  for (const listener of listeners) {
    listener(live);
  }
}

export function subscribeDesk(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

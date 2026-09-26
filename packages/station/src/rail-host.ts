import { RailEngine, type RailStore } from "@station/loop";

const store: RailStore = { checkpoints: [], opens: new Map() };

export function createStationRail(
  send: (state: { draft: string; threadId: string }) => void | Promise<void> = () => undefined,
): RailEngine {
  return new RailEngine({ store, send });
}

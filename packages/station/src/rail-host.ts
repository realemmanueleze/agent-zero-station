import { RailEngine, type DrafterSlot, type RailStore } from "@station/loop";

const store: RailStore = { checkpoints: [], opens: new Map() };

export function createStationRail(
  send: (state: { draft: string; threadId: string }) => void | Promise<void> = () => undefined,
  drafter: DrafterSlot = {},
): RailEngine {
  return new RailEngine({ store, send, modelSlot: drafter });
}

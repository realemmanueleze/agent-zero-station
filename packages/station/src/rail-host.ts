import { RailEngine, type RailStore } from "@station/loop";

const store: RailStore = { checkpoints: [], opens: new Map() };

export function createStationRail(): RailEngine {
  return new RailEngine({
    store,
    send() {
      return undefined;
    },
  });
}

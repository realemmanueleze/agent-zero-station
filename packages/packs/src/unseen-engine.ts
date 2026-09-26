import type { Pack, PackSignal } from "./types.ts";

export const unseenEnginePack: Pack = {
  id: "pack-unseen-engine",
  score(_signal: PackSignal) {
    return [{ name: "consult", value: 0.5, label: "defer_draft" }];
  },
  draft(signal) {
    return `unseen consult for ${signal.from ?? "the lead"}: ${signal.subject ?? signal.text ?? "intro"}`;
  },
  beforePark() {
    return "park";
  },
};

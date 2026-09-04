import type { Pack, PackSignal } from "./types.ts";

export const inboxTriagePack: Pack = {
  id: "inbox-triage",
  score(signal) {
    const urgent = /urgent|asap|invoice/i.test(signal.text ?? signal.subject ?? "");
    return [
      { name: "reply", value: urgent ? 0.7 : 0.25, label: "defer_draft" },
      { name: "drop", value: urgent ? 0.1 : 0.8, label: "inaction_drop" },
      { name: "park", value: urgent ? 0.85 : 0.2, label: "escalate" },
    ];
  },
  draft(signal) {
    return `triage note for ${signal.from ?? "sender"}: ${signal.subject ?? signal.text ?? ""}`;
  },
  beforePark(_draft, signal) {
    const urgent = /urgent|asap|invoice/i.test(signal.text ?? signal.subject ?? "");
    return urgent ? "park" : "drop";
  },
};

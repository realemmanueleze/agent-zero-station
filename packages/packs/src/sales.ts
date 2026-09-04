import type { Pack, PackScore, PackSignal } from "./types.ts";

function amountOf(signal: PackSignal): number {
  if (typeof signal.amount === "number") {
    return signal.amount;
  }
  const match = (signal.text ?? signal.subject ?? "").match(/\$?(\d[\d,]*)/);
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

export const salesPack: Pack = {
  id: "sales",
  score(signal) {
    const amount = amountOf(signal);
    const park = amount >= 10_000 ? 0.91 : 0.4;
    return [
      { name: "close", value: 0.81, label: "defer_draft" },
      { name: "nurture", value: 0.22, label: "inaction_drop" },
      { name: "park", value: park, label: "escalate" },
    ];
  },
  draft(signal, scores) {
    const top = scores.slice().sort((a, b) => b.value - a.value)[0]?.name ?? "park";
    return `sales draft for ${signal.from ?? "lead"}: ${signal.text ?? signal.subject ?? ""}\nintent=${top}`;
  },
  beforePark(draft) {
    const cleaned = draft.replace(/50%/gi, "5%").replace(/below floor/gi, "at floor");
    return cleaned.includes("drop now") ? "drop" : "park";
  },
};

export function salesScores(signal: PackSignal): PackScore[] {
  return salesPack.score(signal);
}

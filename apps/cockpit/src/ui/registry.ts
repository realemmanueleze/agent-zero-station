import type { ParkItem } from "./types.ts";
import { renderParkCardHtml } from "./park-card.tsx";

export type ParkRenderer = (item: ParkItem) => string;

const renderers = new Map<string, ParkRenderer>();

export function registerParkRenderer(packId: string, renderer: ParkRenderer): void {
  renderers.set(packId, renderer);
}

export function getParkRenderer(packId: string): ParkRenderer {
  return renderers.get(packId) ?? renderParkCardHtml;
}

export function resetParkRenderers(): void {
  renderers.clear();
}

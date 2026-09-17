export type DeskLayout = "mobile" | "tablet" | "desktop";

export function deskViewport(width: number): DeskLayout {
  if (width < 720) {
    return "mobile";
  }
  if (width < 1100) {
    return "tablet";
  }
  return "desktop";
}

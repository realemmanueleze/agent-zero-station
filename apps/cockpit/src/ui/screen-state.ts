export type ScreenStatus = "loading" | "error" | "empty" | "ready";

export function screenStateClass(status: ScreenStatus): string {
  return `screen-state is-${status}`;
}

export function renderScreenStateHtml(status: ScreenStatus, message: string): string {
  const role = status === "error" ? "alert" : "status";
  return `<p class="${screenStateClass(status)}" role="${role}">${message}</p>`;
}

export const THEMES = ["system", "light", "dark", "high-contrast"] as const;
export type ThemeName = (typeof THEMES)[number];

export function cycleTheme(current: ThemeName): ThemeName {
  const index = THEMES.indexOf(current);
  return THEMES[(index + 1) % THEMES.length] ?? "system";
}

export function applyTheme(next: ThemeName): void {
  if (typeof document === "undefined") {
    return;
  }
  if (next === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = next;
  }
  try {
    localStorage.setItem("station-theme", next);
  } catch {
    /* storage blocked */
  }
}

export function readStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem("station-theme");
    if (stored === "light" || stored === "dark" || stored === "high-contrast" || stored === "system") {
      return stored;
    }
    if (stored === "default") {
      return "system";
    }
  } catch {
    /* storage blocked */
  }
  return "system";
}

export function themeLabel(theme: ThemeName): string {
  switch (theme) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "high-contrast":
      return "High contrast";
    case "system":
      return "Auto theme";
    default: {
      const _never: never = theme;
      return String(_never);
    }
  }
}

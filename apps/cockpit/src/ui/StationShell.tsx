"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { commandActions, dispatchCommand } from "./commands.ts";
import { deskViewport, type DeskLayout } from "./desk-viewport.ts";
import { PRIVACY_HREF } from "./privacy.ts";
import { applyTheme, cycleTheme, readStoredTheme, themeLabel, type ThemeName } from "./theme.ts";
import { subscribeWaiting } from "./waiting.ts";

const links = [
  { href: "/", label: "Action" },
  { href: "/channels", label: "Channels" },
  { href: "/activity", label: "Activity" },
  { href: "/brief", label: "Brief" },
  { href: "/packs", label: "Packs" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname === "/park";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function runNav(id: string): void {
  switch (id) {
    case "channels":
      window.location.assign("/channels");
      return;
    case "activity":
      window.location.assign("/activity");
      return;
    case "brief":
      window.location.assign("/brief");
      return;
    case "pack":
      window.location.assign("/packs");
      return;
    default:
      return;
  }
}

export function StationShell({
  title,
  waiting = 0,
  children,
}: {
  title: string;
  waiting?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeName>("system");
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState(false);
  const [liveWaiting, setLiveWaiting] = useState(waiting);
  const [layout, setLayout] = useState<DeskLayout>("desktop");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setLiveWaiting(waiting), [waiting]);
  useEffect(() => subscribeWaiting(setLiveWaiting), []);
  useEffect(() => {
    setHydrated(true);
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);
  useEffect(() => {
    const sync = () => setLayout(deskViewport(window.innerWidth));
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  function advanceTheme() {
    setTheme((current) => {
      const next = cycleTheme(current);
      applyTheme(next);
      return next;
    });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing || palette) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        runNav("channels");
      }
      if (key === "y") {
        event.preventDefault();
        runNav("activity");
      }
      if (key === "b") {
        event.preventDefault();
        runNav("brief");
      }
      if (key === "p") {
        event.preventDefault();
        runNav("pack");
      }
      if (key === "t") {
        event.preventDefault();
        advanceTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette, theme]);

  const filteredCommands = useMemo(
    () => commandActions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  function runCommand(id: string) {
    if (id === "theme") {
      advanceTheme();
    } else if (!dispatchCommand(id)) {
      runNav(id);
    }
    setPalette(false);
    setQuery("");
  }

  const split = title.indexOf(": ");
  const kicker = split > 0 ? title.slice(0, split) : "Station";
  const headline = split > 0 ? title.slice(split + 2) : title;

  return (
    <div className="station" data-desk-layout={layout} data-hydrated={hydrated ? "true" : "false"}>
      <aside className="nav-rail">
        <div className="brand">
          <h1>Agent Zero</h1>
        </div>
        <nav className="packs side-nav" aria-label="station">
          {links.map((link) => (
            <a
              key={link.href}
              className={isActive(pathname, link.href) ? "pack on" : "pack"}
              href={link.href}
            >
              {link.label}
              {link.href === "/" && liveWaiting > 0 ? (
                <span className="waiting-chip">{liveWaiting}</span>
              ) : null}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <a className="pack" href="/accounts">
            Accounts
          </a>
          <a className="pack" href={PRIVACY_HREF}>
            Privacy
          </a>
        </div>
      </aside>
      <div className="station-body">
        <header className="top">
          <div className="shell-title">
            <h2>
              {kicker !== "Station" ? `${kicker}: ` : ""}
              {headline}
            </h2>
          </div>
          <div className="top-actions">
            <button type="button" className="command-launch" onClick={() => setPalette(true)}>
              Command ⌘K
            </button>
            <button type="button" data-theme-cycle="true" onClick={advanceTheme}>
              {themeLabel(theme)}
            </button>
          </div>
        </header>
        {children}
      </div>
      {palette ? (
        <div className="palette-scrim" onClick={() => setPalette(false)}>
          <div
            className="palette"
            role="dialog"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              placeholder="Channels, brief, activity, approve…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setPalette(false);
                }
                if (event.key === "Enter" && filteredCommands[0]) {
                  runCommand(filteredCommands[0].id);
                }
              }}
            />
            <ul>
              {filteredCommands.map((action) => (
                <li key={action.id}>
                  <button type="button" onClick={() => runCommand(action.id)}>
                    <span>{action.label}</span>
                    <kbd>{action.hint}</kbd>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

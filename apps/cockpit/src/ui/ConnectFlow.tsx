"use client";

/*
                 ConnectFlow on door
                 /channels  or  /channels/{kind}
            snapshot ids → sessionStorage.station.connect.ids
              ┌──────────────────┼──────────────────┐
        Path 1 Nango        Path 2 station     Path 3 start 4xx
        POST /session       OAuth <a>          worker 302
        location.replace    PKCE stores return {door}?connect=error
*/

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { channelKinds } from "./workspace.ts";
import type { ChannelKind } from "./types.ts";

export const CONNECT_IDS_KEY = "station.connect.ids";

type Step = "kind" | "method" | "imap";

const KIND_CAPTION: Record<ChannelKind, string> = {
  email: "Google, or IMAP",
  slack: "Sign in, or a bot token",
  obsidian: "Vault path",
  db: "Database URL",
  mcp: "Command",
};

function doorPath(kind?: ChannelKind): string {
  return kind ? `/channels/${kind}` : "/channels";
}

function stripConnectError(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("connect")) {
    return;
  }
  url.searchParams.delete("connect");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

async function snapshotIds(): Promise<void> {
  const res = await fetch("/api/connections");
  const json = (await res.json().catch(() => ({}))) as { items?: Array<{ id: string }> };
  const ids = (json.items ?? []).map((row) => row.id);
  sessionStorage.setItem(CONNECT_IDS_KEY, JSON.stringify(ids));
}

function parseSnapshot(): Set<string> | undefined {
  const raw = sessionStorage.getItem(CONNECT_IDS_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) {
      return undefined;
    }
    return new Set(ids.map((row) => String(row)));
  } catch {
    return undefined;
  }
}

export function ConnectFlow({ kind }: { kind?: ChannelKind }) {
  const router = useRouter();
  const [picked, setPicked] = useState<ChannelKind | undefined>(kind);
  const [step, setStep] = useState<Step>(kind ? "method" : "kind");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nangoOn, setNangoOn] = useState(false);
  const showBack = kind === undefined && step !== "kind";
  const title = !picked || step === "kind" ? "Add source" : picked === "email" ? "Add email" : `Add ${picked}`;

  useEffect(() => {
    void fetch("/api/nango/status")
      .then((res) => res.json() as Promise<{ enabled?: boolean }>)
      .then((json) => setNangoOn(Boolean(json.enabled)))
      .catch(() => setNangoOn(false));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connect") === "error") {
      sessionStorage.removeItem(CONNECT_IDS_KEY);
      setError("Sign in didn't finish. Try again.");
    }
  }, []);

  useEffect(() => {
    if (!nangoOn) {
      return;
    }
    const pull = (): void => {
      void (async () => {
        await fetch("/api/nango/import", { method: "POST" });
        const listed = await fetch("/api/connections");
        const json = (await listed.json().catch(() => ({}))) as {
          items?: Array<{ id: string; kind: ChannelKind }>;
        };
        const snapshot = parseSnapshot();
        if (!snapshot) {
          return;
        }
        const created = (json.items ?? []).find((row) => !snapshot.has(row.id));
        if (!created) {
          return;
        }
        sessionStorage.removeItem(CONNECT_IDS_KEY);
        window.location.assign(`/channels/${created.kind}/${created.id}`);
      })();
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") {
        pull();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", pull);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", pull);
    };
  }, [nangoOn]);

  function pickKind(next: ChannelKind): void {
    setPicked(next);
    setStep("method");
    setError("");
  }

  function backToKinds(): void {
    setPicked(undefined);
    setStep("kind");
    setError("");
  }

  async function onNangoSignIn(): Promise<void> {
    if (!picked) {
      return;
    }
    setError("");
    stripConnectError();
    try {
      await snapshotIds();
      const res = await fetch("/api/nango/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: picked }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        connectLink?: string;
        error?: { message?: string };
      };
      if (!res.ok || !json.connectLink) {
        setError(json.error?.message ?? "Sign in didn't finish. Try again.");
        return;
      }
      window.location.replace(json.connectLink);
    } catch {
      setError("Sign in didn't finish. Try again.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!picked) {
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = bodyFromForm(picked, form);
    try {
      const created = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await created.json()) as { id?: string; error?: { message?: string } };
      if (!created.ok || !json.id) {
        setError(json.error?.message ?? "could not save");
        setBusy(false);
        return;
      }
      const tested = await fetch(`/api/connections/${json.id}/test`, { method: "POST" });
      if (!tested.ok) {
        const testedJson = (await tested.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(testedJson.error?.message ?? "testing login failed");
        router.refresh();
        setBusy(false);
        return;
      }
      window.location.assign(`/channels/${picked}/${json.id}`);
    } catch {
      setError("could not save");
      setBusy(false);
    }
  }

  return (
    <aside className="add-source">
      <h3>{title}</h3>
      {step === "kind" ? (
        <p className="mute">Add a source, or open a kind. Each account is isolated.</p>
      ) : picked === "email" ? (
        <p className="mute">Connecting never sends. Approve still owns send.</p>
      ) : (
        <p className="mute">Sign in when the platform allows it, or paste the fields for this kind. Connecting never sends.</p>
      )}
      {step === "kind" ? (
        <ul className="source-roster">
          {channelKinds.map((row) => (
            <li key={row}>
              <button type="button" onClick={() => pickKind(row)}>
                <strong>{row}</strong>
                <span>{KIND_CAPTION[row]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {step === "method" || step === "imap" ? (
        <>
          {picked === "email" ? (
            <>
              <SignInControl
                nangoOn={nangoOn}
                label="Sign in with Google"
                href={`/oauth/google/start?return=${encodeURIComponent(doorPath(kind ?? picked))}`}
                onNango={onNangoSignIn}
              />
              <p className="mute">Testing tokens die in 7 days.</p>
              {step === "method" ? (
                <button type="button" className="mute-action" onClick={() => setStep("imap")}>
                  Use IMAP/SMTP instead
                </button>
              ) : null}
            </>
          ) : null}
          {picked === "slack" ? (
            <SignInControl
              nangoOn={nangoOn}
              label="Sign in with Slack"
              href={`/oauth/slack/start?return=${encodeURIComponent(doorPath(kind ?? picked))}`}
              onNango={onNangoSignIn}
            />
          ) : null}
          {step === "imap" || (picked && picked !== "email") ? (
            <form onSubmit={onSubmit}>
              {picked ? <KindFields kind={picked} imap={step === "imap"} /> : null}
              <button type="submit" className="quiet-pill" disabled={busy}>
                {busy ? "testing login" : "Add"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {showBack ? (
        <button type="button" className="mute-action" onClick={backToKinds}>
          Back to kinds
        </button>
      ) : null}
      {error ? (
        <p className="mute" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}

function SignInControl({
  nangoOn,
  label,
  href,
  onNango,
}: {
  nangoOn: boolean;
  label: string;
  href: string;
  onNango: () => void;
}) {
  if (nangoOn) {
    return (
      <button type="button" className="quiet-pill" onClick={() => void onNango()}>
        {label}
      </button>
    );
  }
  return (
    <a className="quiet-pill" href={href}>
      {label}
    </a>
  );
}

function KindFields({ kind, imap }: { kind: ChannelKind; imap: boolean }) {
  switch (kind) {
    case "email":
      if (!imap) {
        return null;
      }
      return (
        <>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" />
          </label>
          <label>
            SMTP host
            <input name="smtp-host" defaultValue="smtp.gmail.com" />
          </label>
          <label>
            IMAP host
            <input name="imap-host" defaultValue="imap.gmail.com" />
          </label>
        </>
      );
    case "slack":
      return (
        <>
          <label>
            Workspace
            <input name="workspace" />
          </label>
          <label>
            Slack token
            <input name="slack-token" type="password" />
          </label>
        </>
      );
    case "obsidian":
      return (
        <label>
          Vault path
          <input name="vault-path" />
        </label>
      );
    case "db":
      return (
        <label>
          Database url
          <input name="db-url" />
        </label>
      );
    case "mcp":
      return (
        <>
          <label>
            Name
            <input name="mcp-name" />
          </label>
          <label>
            Command
            <input name="mcp-command" />
          </label>
          <label>
            Args
            <input name="mcp-args" />
          </label>
        </>
      );
    default: {
      const _never: never = kind;
      return <p className="mute">unknown kind {String(_never)}</p>;
    }
  }
}

function bodyFromForm(kind: ChannelKind, form: FormData): Record<string, unknown> {
  switch (kind) {
    case "email": {
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      return {
        kind,
        imapHost: String(form.get("imap-host") ?? "imap.gmail.com"),
        imapPort: 993,
        imapTls: true,
        imapUser: email,
        imapPass: password,
        smtpHost: String(form.get("smtp-host") ?? "smtp.gmail.com"),
        smtpPort: 587,
        smtpTls: true,
        smtpUser: email,
        smtpPass: password,
      };
    }
    case "slack":
      return {
        kind,
        workspaceId: String(form.get("workspace") ?? ""),
        slackToken: String(form.get("slack-token") ?? ""),
      };
    case "obsidian":
      return { kind, vaultPath: String(form.get("vault-path") ?? "") };
    case "db":
      return { kind, url: String(form.get("db-url") ?? "") };
    case "mcp":
      return {
        kind,
        name: String(form.get("mcp-name") ?? ""),
        command: String(form.get("mcp-command") ?? ""),
        args: String(form.get("mcp-args") ?? "")
          .split(" ")
          .map((row) => row.trim())
          .filter(Boolean),
      };
    default: {
      const _never: never = kind;
      return { kind: String(_never) };
    }
  }
}

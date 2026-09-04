"use client";

import { useState, type FormEvent } from "react";
import type { ChannelKind } from "./types.ts";

export function AddSourcePanel({ kind }: { kind: ChannelKind }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = bodyFromForm(kind, form);
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
        setError("testing login failed");
        setBusy(false);
        return;
      }
      window.location.assign(`/channels/${kind}/${json.id}`);
    } catch {
      setError("could not save");
      setBusy(false);
    }
  }

  return (
    <aside className="add-source">
      <h3>Add source</h3>
      {kind === "email" ? (
        <>
          <a className="quiet-pill" href="/oauth/google/start">
            Sign in with Google
          </a>
          <p className="mute">Testing tokens die in 7 days.</p>
        </>
      ) : null}
      {kind === "slack" ? (
        <a className="quiet-pill" href="/oauth/slack/start">
          Sign in with Slack
        </a>
      ) : null}
      <form onSubmit={onSubmit}>
        <KindFields kind={kind} />
        <button type="submit" className="quiet-pill" disabled={busy}>
          {busy ? "testing login" : "Add"}
        </button>
        {error ? <p className="mute">{error}</p> : null}
      </form>
    </aside>
  );
}

function KindFields({ kind }: { kind: ChannelKind }) {
  switch (kind) {
    case "email":
      return (
        <>
          <label>
            IMAP host
            <input name="imap-host" defaultValue="imap.gmail.com" />
          </label>
          <label>
            IMAP user
            <input name="imap-user" />
          </label>
          <label>
            IMAP password
            <input name="imap-password" type="password" />
          </label>
          <label>
            SMTP host
            <input name="smtp-host" defaultValue="smtp.gmail.com" />
          </label>
          <label>
            SMTP user
            <input name="smtp-user" />
          </label>
          <label>
            SMTP password
            <input name="smtp-password" type="password" />
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
    case "email":
      return {
        kind,
        imapHost: String(form.get("imap-host") ?? ""),
        imapPort: 993,
        imapTls: true,
        imapUser: String(form.get("imap-user") ?? ""),
        imapPass: String(form.get("imap-password") ?? ""),
        smtpHost: String(form.get("smtp-host") ?? ""),
        smtpPort: 587,
        smtpTls: true,
        smtpUser: String(form.get("smtp-user") ?? ""),
        smtpPass: String(form.get("smtp-password") ?? ""),
      };
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

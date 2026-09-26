"use client";

import { useState } from "react";
import { StationShell } from "./StationShell.tsx";

type Hit = { account: string; from: string; subject: string; reason: string; draft?: string; thread?: string };
type Run = { scanned: number; needsAction: Hit[]; webhookStatus: number | null; name: string };

export function WorkflowView({ waiting }: { waiting: number }) {
  const [text, setText] = useState("scan mail from the last 3 days and webhook https://");
  const [everyMin, setEveryMin] = useState("60");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/workflows/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const json = (await res.json()) as Run & { error?: { message?: string } };
    setBusy(false);
    if (!res.ok) {
      setError(json.error?.message ?? "The run did not finish.");
      return;
    }
    setRun(json);
  }

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const webhookUrl = text.match(/https?:\/\/\S+/)?.[0] ?? "";
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Scheduled mail scan",
        days: 3,
        webhookUrl,
        everyMs: Number(everyMin) * 60_000,
      }),
    });
    if (!res.ok) {
      setError("The schedule did not save.");
    }
  }

  return (
    <StationShell title="Workflows" waiting={waiting}>
      <main className="work stack">
        <p className="note">
          Ask for a mail scan. The station reads connected Gmail, keeps what needs a person, parks those slips, then posts the list to the webhook.
        </p>
        <form className="brief-form" onSubmit={ask}>
          <input aria-label="Ask the station" value={text} onChange={(event) => setText(event.target.value)} />
          <button type="submit" className="quiet-pill" disabled={busy}>
            Run
          </button>
        </form>
        <form className="brief-form" onSubmit={schedule}>
          <label>
            Repeat every
            <input aria-label="Minutes" value={everyMin} onChange={(event) => setEveryMin(event.target.value)} />
            minutes
          </label>
          <button type="submit" className="quiet-pill">
            Save schedule
          </button>
        </form>
        {error ? (
          <p role="alert">{error}</p>
        ) : null}
        {run ? (
          <section>
            <p>
              {run.name} scanned {run.scanned}. {run.needsAction.length} need you.
              {run.webhookStatus ? ` Webhook ${run.webhookStatus}.` : ""}
            </p>
            <ul className="source-roster">
              {run.needsAction.map((hit) => (
                <li key={`${hit.account}-${hit.subject}`}>
                  <strong>{hit.subject}</strong>
                  <span>
                    {hit.from} · {hit.account} · {hit.reason}
                  </span>
                  {hit.thread ? <pre>{hit.thread}</pre> : null}
                  {hit.draft ? <p>Draft, editable on Action: {hit.draft}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </StationShell>
  );
}

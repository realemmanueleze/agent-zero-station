"use client";

import { useState } from "react";
import { listPackIds, type PackId } from "@station/packs";
import { ScreenState } from "./ScreenState.tsx";
import { StationShell } from "./StationShell.tsx";

function isPackId(value: string): value is PackId {
  return (listPackIds() as string[]).includes(value);
}

export function PacksDeck({ initialActive }: { initialActive: PackId }) {
  const [active, setActive] = useState<PackId>(initialActive);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(id: PackId) {
    setError(null);
    try {
      const res = await fetch(`/packs/${id}/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const json = (await res.json()) as { packId?: string; error?: { code?: string } };
      if (!res.ok || json.error?.code || !json.packId || !isPackId(json.packId)) {
        setError(json.error?.code ?? "pack.activate_failed");
        return;
      }
      setActive(json.packId);
      setNotice(`Active pack is ${json.packId}. Replay the same signals.`);
    } catch {
      setError("pack.activate_failed");
    }
  }

  return (
    <StationShell title="Packs: switch the scoring brain">
      <main className="work stack">
        <p className="note">Active: {active}. Replay the same signals after you switch.</p>
        <ul className="source-roster">
          {listPackIds().map((id) => (
            <li key={id}>
              <button
                type="button"
                data-pack={id}
                className={id === active ? "on" : undefined}
                onClick={() => void activate(id)}
              >
                <strong>{id}</strong>
                <span>
                  {id === "sales"
                    ? "Deal size, closer, park over $10k."
                    : "Route inbound. Park when the ask is unclear."}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {error ? <ScreenState status="error" title={error} /> : null}
        {notice ? (
          <ScreenState status="ready" title={notice} />
        ) : null}
      </main>
    </StationShell>
  );
}

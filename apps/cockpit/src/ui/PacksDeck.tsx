"use client";

import { useState } from "react";
import { listPackIds, type PackId } from "@station/packs";
import { StationShell } from "./StationShell.tsx";

export function PacksDeck() {
  const [active, setActive] = useState<PackId>("sales");
  const [notice, setNotice] = useState<string | null>(null);

  async function activate(id: PackId) {
    const res = await fetch(`/packs/${id}/activate`, { method: "POST" });
    const json = (await res.json()) as { packId?: string; error?: { code?: string } };
    if (json.error?.code) {
      setNotice(json.error.code);
      return;
    }
    setActive((json.packId as PackId) ?? id);
    setNotice(`Active pack is ${json.packId ?? id}. Replay the same signals.`);
  }

  return (
    <StationShell title="Packs: switch the scoring brain">
      <main className="work">
        <p className="note">Active: {active}</p>
        <div className="packs">
          {listPackIds().map((id) => (
            <button
              key={id}
              type="button"
              className={id === active ? "pack on" : "pack"}
              onClick={() => void activate(id)}
            >
              pack: {id}
            </button>
          ))}
        </div>
        {notice ? <p className="toast">{notice}</p> : null}
      </main>
    </StationShell>
  );
}

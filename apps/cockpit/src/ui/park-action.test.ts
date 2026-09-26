import { describe, expect, it } from "vitest";
import { interpretParkAction, ledgerSentence, tickWord, waitingCount } from "./park-action.ts";
import type { ParkItem } from "./types.ts";

function jsonRes(status: number, body: unknown): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("park action contract", () => {
  it("does not mark sent when approve returns 200 without state", async () => {
    const result = await interpretParkAction(jsonRes(200, {}), "approve");
    expect(result.ok).toBe(false);
    expect(result.state).toBeUndefined();
    expect(result.notice).toMatch(/park\.invalid|missing state/i);
  });

  it("surfaces error.code and does not invent sent", async () => {
    const result = await interpretParkAction(
      jsonRes(409, { error: { code: "lease.held" } }),
      "approve",
    );
    expect(result.ok).toBe(false);
    expect(result.notice).toBe("lease.held");
    expect(result.state).toBeUndefined();
  });

  it("rejects !res.ok without a code", async () => {
    const result = await interpretParkAction(jsonRes(500, { message: "boom" }), "approve");
    expect(result.ok).toBe(false);
    expect(result.notice).toMatch(/park\.failed|500/);
  });

  it("rejects invalid JSON", async () => {
    const result = await interpretParkAction(
      {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("bad json");
        },
      },
      "kill",
    );
    expect(result.ok).toBe(false);
    expect(result.notice).toMatch(/park\.failed|json/i);
  });

  it("keeps a thrown fetch as a failed action", async () => {
    await expect(
      interpretParkAction(
        (async () => {
          throw new TypeError("Failed to fetch");
        })(),
        "edit",
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("accepts an explicit state on ok", async () => {
    const result = await interpretParkAction(jsonRes(200, { state: "sent", body: "ok" }), "approve");
    expect(result).toEqual({ ok: true, state: "sent", body: "ok", notice: "Sent. Watching for a reply." });
  });

  it("names edit and kill success without inventing sent", async () => {
    const edited = await interpretParkAction(jsonRes(200, { state: "parked", body: "revised" }), "edit");
    expect(edited).toEqual({
      ok: true,
      state: "parked",
      body: "revised",
      notice: "Draft updated. Still parked.",
    });
    const killed = await interpretParkAction(jsonRes(200, { state: "dropped" }), "kill", "parked");
    expect(killed.ok).toBe(true);
    expect(killed.state).toBe("dropped");
    expect(killed.notice).toBe("Killed. Nothing was sent.");
    const inflight = await interpretParkAction(jsonRes(200, { state: "dropped" }), "kill", "sending");
    expect(inflight.notice).toBe("Killed. If the provider already accepted it, that copy stays out.");
    const sent = await interpretParkAction(jsonRes(200, { state: "dropped" }), "kill", "sent");
    expect(sent.notice).toBe("Killed. The sent message stays sent.");
  });

  it("maps send failures to one sentence each", async () => {
    const refused = await interpretParkAction(
      jsonRes(502, { error: { code: "send.provider_failed" } }),
      "approve",
    );
    expect(refused.notice).toBe("The provider refused the send. The slip stays parked.");
    const flight = await interpretParkAction(jsonRes(409, { error: { code: "send.in_flight" } }), "approve");
    expect(flight.notice).toBe("Send in progress. Do not Approve again.");
    const attempted = await interpretParkAction(
      jsonRes(409, { error: { code: "send.already_attempted" } }),
      "approve",
    );
    expect(attempted.notice).toBe("This send failed. Park a new draft to try again.");
    const killed = await interpretParkAction(jsonRes(409, { error: { code: "send.killed" } }), "approve");
    expect(killed.notice).toBe("Killed. Approve will not send.");
    const watched = await interpretParkAction(jsonRes(409, { error: { code: "run.wait_conflict" } }), "approve");
    expect(watched.ok).toBe(false);
    expect(watched.state).toBe("sent");
    expect(watched.notice).toBe("Sent. This thread is already being watched.");
  });
});

describe("ledger sentences", () => {
  const parked: ParkItem = { id: "a", state: "parked", runId: "run-1" };
  const sent: ParkItem = { id: "b", state: "sent", runId: "run-1" };
  const reply: ParkItem = { id: "c", state: "parked", runId: "run-1" };

  it("names parked, sending, sent, reply, and the three kills", () => {
    expect(ledgerSentence(parked, [parked])).toBe("Parked.");
    expect(ledgerSentence({ id: "s", state: "sending" }, [])).toBe("Sending.");
    expect(ledgerSentence(sent, [sent])).toBe("Sent. Watching for a reply.");
    expect(ledgerSentence(sent, [sent, reply])).toBe("Sent. Reply is parked.");
    expect(ledgerSentence({ id: "d", state: "dropped", killPhase: "unsent" }, [])).toBe("Killed. Nothing was sent.");
    expect(ledgerSentence({ id: "d", state: "dropped", killPhase: "inflight" }, [])).toBe(
      "Killed. If the provider already accepted it, that copy stays out.",
    );
    expect(ledgerSentence({ id: "d", state: "dropped", killPhase: "sent" }, [])).toBe(
      "Killed. The sent message stays sent.",
    );
    expect(tickWord("Sent. Watching for a reply.")).toBe("Sent");
    expect(tickWord("Killed. Nothing was sent.")).toBe("Killed");
    expect(waitingCount([parked, { id: "s", state: "sending" }, sent])).toBe(2);
  });
});

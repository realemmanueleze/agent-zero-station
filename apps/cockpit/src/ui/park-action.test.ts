import { describe, expect, it } from "vitest";
import { interpretParkAction } from "./park-action.ts";

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
    expect(result).toEqual({ ok: true, state: "sent", body: "ok", notice: "Sent. Model never called commit_send." });
  });

  it("names edit and kill success without inventing sent", async () => {
    const edited = await interpretParkAction(jsonRes(200, { state: "parked", body: "revised" }), "edit");
    expect(edited).toEqual({
      ok: true,
      state: "parked",
      body: "revised",
      notice: "Draft updated. Still parked.",
    });
    const killed = await interpretParkAction(jsonRes(200, { state: "dropped" }), "kill");
    expect(killed.ok).toBe(true);
    expect(killed.state).toBe("dropped");
    expect(killed.notice).toBe("Marked dropped.");
  });
});

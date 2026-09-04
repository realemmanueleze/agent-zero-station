import { describe, expect, it } from "vitest";
import {
  StationError,
  createLogger,
  errorCodes,
  runWithContext,
  toClientError,
} from "./index.ts";

describe("StationError", () => {
  it("client JSON has code, message, requestId and never stack or cause", () => {
    const err = new StationError({
      code: "send.provider_failed",
      message: "gmail 502",
      requestId: "req-1",
      cause: new Error("secret stack"),
    });
    const json = toClientError(err);
    expect(json.error.code).toBe("send.provider_failed");
    expect(json.error.message).toBe("gmail 502");
    expect(json.error.requestId).toBe("req-1");
    expect(JSON.stringify(json)).not.toMatch(/stack|secret stack/i);
    expect(json.error).not.toHaveProperty("cause");
    expect(json.error).not.toHaveProperty("stack");
  });

  it("send.provider_failed is retryable 502", () => {
    const err = new StationError({ code: "send.provider_failed", message: "down" });
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(502);
    expect(errorCodes["send.provider_failed"].retryable).toBe(true);
  });

  it("invariant.missing_tenant is not retryable 500", () => {
    const err = new StationError({
      code: "invariant.missing_tenant",
      message: "tenant required",
    });
    expect(err.retryable).toBe(false);
    expect(err.status).toBe(500);
  });
});

describe("logger", () => {
  it("redacts master key, bearer tokens, and mail bodies", () => {
    const lines: string[] = [];
    const log = createLogger({
      service: "test",
      write: (line) => lines.push(line),
    });
    log.info("approve", {
      STATION_MASTER_KEY: "super-secret",
      authorization: "Bearer abc.def",
      body: "Quote for $12400 confidential",
    });
    const dumped = lines.join("\n");
    expect(dumped).not.toContain("super-secret");
    expect(dumped).not.toContain("abc.def");
    expect(dumped).not.toContain("12400");
    expect(dumped).toMatch(/\[REDACTED\]/);
  });

  it("withContext always emits service and requestId", () => {
    const lines: unknown[] = [];
    const log = createLogger({
      service: "worker",
      write: (line) => lines.push(JSON.parse(line)),
    }).withContext({ requestId: "req-9" });
    log.info("claimed");
    const row = lines[0] as { service: string; requestId: string; msg: string };
    expect(row.service).toBe("worker");
    expect(row.requestId).toBe("req-9");
    expect(row.msg).toBe("claimed");
  });
});

describe("runWithContext", () => {
  it("stamps requestId on StationError thrown inside", async () => {
    await expect(
      runWithContext({ requestId: "req-ctx" }, async () => {
        throw new StationError({ code: "claim.taken", message: "held" });
      }),
    ).rejects.toMatchObject({ requestId: "req-ctx", code: "claim.taken" });
  });

  it("client JSON for every catalog code includes that code and never a stack", () => {
    for (const code of Object.keys(errorCodes) as Array<keyof typeof errorCodes>) {
      const json = toClientError(
        new StationError({ code, message: "safe", requestId: "req-catalog" }),
      );
      expect(json.error.code).toBe(code);
      expect(JSON.stringify(json)).not.toMatch(/stack/i);
    }
  });

  it("maps unknown throws at the edge to invariant.unhandled", async () => {
    const lines: string[] = [];
    const log = createLogger({
      service: "worker",
      write: (line) => lines.push(line),
    });
    const mapped = await runWithContext(
      { requestId: "req-edge", log },
      async () => {
        throw "boom";
      },
    ).catch((err: unknown) => err);
    expect(mapped).toBeInstanceOf(StationError);
    expect(mapped).toMatchObject({
      code: "invariant.unhandled",
      requestId: "req-edge",
      status: 500,
    });
    expect(lines.join("\n")).toMatch(/"level":"error"/);
  });
});

import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { ConnectionStore } from "../../packages/station/src/connections.ts";
import { completeNangoConnection, createNangoSession } from "../../packages/station/src/nango.ts";

const SECRET = "nango-eval-secret";

describe("nango.connect (gate: merge)", () => {
  it("session has a connect link; complete is live; send stays human", async () => {
    const started = await createNangoSession({
      kind: "email",
      env: { NANGO_SECRET_KEY: SECRET },
      fetchImpl: async () => ({
        status: 201,
        json: async () => ({
          data: { connect_link: "https://connect.nango.dev/link/eval", expires_at: "2026-09-07T01:00:00Z" },
        }),
      }),
    });
    expect(started.connectLink).toContain("connect.nango.dev");
    expect(JSON.stringify(started)).not.toContain(SECRET);
    const env = { STATION_MASTER_KEY: "local-dev-master-key-32-bytes!!!!", NANGO_SECRET_KEY: SECRET };
    const created = completeNangoConnection({
      store: new ConnectionStore(() => env),
      env,
      connectionId: "eval-1",
      integration: "google-mail",
      account: "eval@gmail.com",
    });
    expect(created.status).toBe("live");
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});

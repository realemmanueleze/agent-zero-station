import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("T4 cockpit", () => {
  it("localhost without password: park list 200", async () => {
    const res = await station.cockpit.parkList({ host: "127.0.0.1" });
    expect(res.status).toBe(200);
  });

  it("non-localhost without password is 401 auth.cockpit_password", async () => {
    const res = await station.cockpit.parkList({ host: "203.0.113.10" });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: { code: "auth.cockpit_password" } });
  });

  it("Approve proxies the control token; the browser never sees it", async () => {
    const hop = await station.cockpit.approveFromBrowser("dec-1");
    expect(hop.workerAuthorization).toMatch(/^Bearer /);
    expect(hop.browserHtml).not.toContain("STATION_CONTROL_TOKEN");
    expect(hop.browserHtml).not.toContain(hop.workerAuthorization);
  });

  it("failed Approve shows error.code and never a stack", async () => {
    const hop = await station.cockpit.approveFromBrowser("dec-fail");
    expect(hop.error?.code).toBeTruthy();
    expect(hop.error?.stack).toBeUndefined();
  });

  it("theme tokens load; missing station.theme.css is not an error", async () => {
    const theme = await station.cockpit.themeStatus();
    expect(theme.tokensLoaded).toBe(true);
    expect(theme.missingStationThemeIsError).toBe(false);
  });
});

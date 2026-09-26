import { describe, expect, it } from "vitest";
import { cockpitAccess } from "./cockpit-auth.ts";

describe("cockpitAccess", () => {
  it("localhost stays open; Nango webhook stays HMAC-only off-box", () => {
    expect(cockpitAccess({ host: "127.0.0.1", path: "/park" })).toBe("allow");
    expect(cockpitAccess({ host: "localhost", path: "/api/nango/session" })).toBe("allow");
    expect(
      cockpitAccess({
        host: "203.0.113.10",
        path: "/api/nango/webhook",
        envPassword: "desk",
      }),
    ).toBe("allow");
  });

  it("off-box without a configured password is deny; with password needs the cookie", () => {
    expect(cockpitAccess({ host: "203.0.113.10", path: "/park" })).toBe("deny");
    expect(cockpitAccess({ host: "203.0.113.10", path: "/api/nango/import" })).toBe("deny");
    expect(cockpitAccess({ host: "203.0.113.10", path: "/nango/start", envPassword: "desk" })).toBe("login");
    expect(
      cockpitAccess({
        host: "203.0.113.10",
        path: "/api/nango/session",
        envPassword: "desk",
        providedPassword: "desk",
      }),
    ).toBe("allow");
    expect(cockpitAccess({ host: "203.0.113.10", path: "/login", envPassword: "desk" })).toBe("allow");
    expect(cockpitAccess({ host: "203.0.113.10", path: "/login" })).toBe("deny");
    expect(
      cockpitAccess({
        host: "localhost",
        path: "/park",
        forwardedFor: "203.0.113.10",
      }),
    ).toBe("deny");
    expect(
      cockpitAccess({
        host: "127.0.0.1",
        path: "/api/nango/import",
        clientIp: "198.51.100.9",
      }),
    ).toBe("deny");
  });
});

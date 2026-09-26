import { describe, expect, it } from "vitest";
import { connectErrorLocation, oauthReturnPath } from "./oauth-return.ts";

describe("oauthReturnPath", () => {
  it("keeps allowlisted doors and kind detail pages", () => {
    expect(oauthReturnPath("/channels")).toBe("/channels");
    expect(oauthReturnPath("/channels/email")).toBe("/channels/email");
    expect(oauthReturnPath("/channels/slack")).toBe("/channels/slack");
    expect(oauthReturnPath("/channels/email/conn-1")).toBe("/channels/email/conn-1");
    expect(oauthReturnPath("/channels/slack/conn-1")).toBe("/channels/slack/conn-1");
  });

  it("coerces junk and open redirects to the fallback", () => {
    expect(oauthReturnPath("https://evil.example", "/channels")).toBe("/channels");
    expect(oauthReturnPath("/channels/email/%0d%0a", "/channels")).toBe("/channels");
    expect(oauthReturnPath("", "/channels/email")).toBe("/channels/email");
    expect(oauthReturnPath(null, "/channels/slack")).toBe("/channels/slack");
  });

  it("builds a door connect-error Location", () => {
    expect(connectErrorLocation("http://127.0.0.1:19173", "/channels/email")).toBe(
      "http://127.0.0.1:19173/channels/email?connect=error",
    );
  });
});

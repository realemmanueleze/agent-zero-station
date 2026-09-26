import { describe, expect, it } from "vitest";
import { PkceMap } from "./pkce.ts";

describe("PkceMap return path", () => {
  it("stores returnPath on start and returns it from consume", () => {
    const map = new PkceMap();
    const started = map.start("/channels/email");
    expect(map.consume(started.state)).toEqual({
      verifier: started.verifier,
      returnPath: "/channels/email",
    });
  });

  it("defaults a missing returnPath to empty so callers pick a door fallback", () => {
    const map = new PkceMap();
    const started = map.start();
    expect(map.consume(started.state).returnPath).toBe("");
  });
});

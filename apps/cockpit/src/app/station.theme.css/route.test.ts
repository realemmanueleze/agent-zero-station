import { describe, expect, it } from "vitest";
import { GET } from "./route.ts";

describe("station.theme.css", () => {
  it("missing install-root file is not the old park-page theme.css", async () => {
    const res = await GET();
    const css = await res.text();
    expect(css).not.toMatch(/button\s*\{\s*background:\s*var\(--ink\)/);
    expect(css).toMatch(/station\.theme\.css| --bg |--ink/);
  });
});

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const ticketsDir = join(root, "tickets");

describe("ticket inventory", () => {
  it("every ticket folder has tests.md, evals.md, and an executable test file", () => {
    const tickets = readdirSync(ticketsDir).filter((name) => name.startsWith("T"));
    expect(tickets.length).toBeGreaterThanOrEqual(8);
    for (const ticket of tickets) {
      expect(existsSync(join(ticketsDir, ticket, "tests.md")), `${ticket} tests.md`).toBe(
        true,
      );
      expect(existsSync(join(ticketsDir, ticket, "evals.md")), `${ticket} evals.md`).toBe(
        true,
      );
      if (ticket === "T0-observability") {
        expect(
          existsSync(join(root, "packages/observability/src/observability.test.ts")),
        ).toBe(true);
        continue;
      }
      expect(existsSync(join(root, "tests/tickets", `${ticket}.test.ts`))).toBe(true);
    }
  });

  it("ENGINEERING.md states tests come before program code", () => {
    const law = readFileSync(join(root, "docs/ENGINEERING.md"), "utf8");
    expect(law).toMatch(/Code is written to pass tests and evals/);
    expect(law).toMatch(/StationError/);
  });
});

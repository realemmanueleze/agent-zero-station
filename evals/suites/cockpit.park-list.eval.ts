import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("cockpit.park-list (gate: merge)", () => {
  it("fixture park appears parked with Approve, Edit, and Kill actions", async () => {
    const { item } = await station.cockpit.parkPayload();
    expect(item.state).toBe("parked");
    expect(item.actions).toEqual(expect.arrayContaining(["Approve", "Edit", "Kill"]));
  });
});

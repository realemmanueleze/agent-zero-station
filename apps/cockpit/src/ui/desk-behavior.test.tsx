/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createDeskFixture, deskFixtureFetch } from "./desk-fixture.ts";
import { deskViewport } from "./desk-viewport.ts";
import { PacksDeck } from "./PacksDeck.tsx";
import { ParkQueue } from "./ParkQueue.tsx";
import { ActionDeck } from "./ActionDeck.tsx";
import { ConnectFlow } from "./ConnectFlow.tsx";
import { ConnectionView } from "./ConnectionView.tsx";
import { StationShell } from "./StationShell.tsx";
import { applyTheme, cycleTheme, readStoredTheme, themeLabel, THEMES, type ThemeName } from "./theme.ts";
import type { ParkItem } from "./types.ts";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

const parked: ParkItem = {
  id: "park-1",
  state: "parked",
  channel: "email",
  accountId: "one@gmail.com",
  tenantId: "tenant-a",
  packId: "sales",
  from: "ada@northwind.io",
  subject: "Need a quote",
  body: "Can you send twelve seats?",
};

function mockFetch(fixture: ReturnType<typeof createDeskFixture>, delayMs = 0): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return deskFixtureFetch(fixture, input, init);
    }),
  );
}

describe("T31 desk behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    applyTheme("system");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("edits, cancels, then saves a draft", async () => {
    const fixture = createDeskFixture();
    mockFetch(fixture);
    render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
    const box = screen.getByLabelText("Edit draft");
    fireEvent.change(box, { target: { value: "twelve seats, revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.querySelector(".park-card .body")?.textContent).toBe("Can you send twelve seats?");
    fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
    fireEvent.change(screen.getByLabelText("Edit draft"), { target: { value: "twelve seats, revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(document.querySelector(".park-card .body")?.textContent).toBe("twelve seats, revised"));
    expect(screen.getByText(/Still parked/)).toBeTruthy();
    expect(fixture.items[0]?.state).toBe("parked");
  });

  it("approve success, failure, and double-click send once", async () => {
    const ok = createDeskFixture();
    mockFetch(ok, 40);
    const first = render(<ParkQueue items={[{ ...parked }]} />);
    const approve = screen.getByRole("button", { name: "Approve" });
    fireEvent.click(approve);
    fireEvent.click(approve);
    await waitFor(() => expect(screen.getAllByText("Sent. Watching for a reply.").length).toBeGreaterThan(0));
    expect(ok.approveCalls).toBe(1);
    expect(ok.items[0]?.state).toBe("sent");
    first.unmount();

    const fail = createDeskFixture({ mode: "approve-fail" });
    mockFetch(fail);
    render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText("The provider refused the send. The slip stays parked.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it("kill marks the row dropped", async () => {
    const fixture = createDeskFixture();
    mockFetch(fixture);
    render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Kill" }));
    await waitFor(() => expect(screen.getAllByText("Killed. Nothing was sent.").length).toBeGreaterThan(0));
    expect(fixture.items[0]?.state).toBe("dropped");
  });

  it("keyboard E then A then K hits the first parked card", async () => {
    const editFix = createDeskFixture();
    mockFetch(editFix);
    const editView = render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.keyDown(window, { key: "e" });
    expect(screen.getByLabelText("Edit draft")).toBeTruthy();
    editView.unmount();

    const killFix = createDeskFixture();
    mockFetch(killFix);
    render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.keyDown(window, { key: "k" });
    await waitFor(() => expect(screen.getAllByText("Killed. Nothing was sent.").length).toBeGreaterThan(0));
  });

  it("keyboard A approves once through the mock", async () => {
    const fixture = createDeskFixture();
    mockFetch(fixture);
    render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "a" });
    await waitFor(() => expect(screen.getAllByText("Sent. Watching for a reply.").length).toBeGreaterThan(0));
    expect(fixture.approveCalls).toBe(1);
  });

  it("network and malformed responses stay parked", async () => {
    const net = createDeskFixture({ mode: "network" });
    mockFetch(net);
    const first = render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText("park.failed")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    first.unmount();

    const bad = createDeskFixture({ mode: "malformed" });
    mockFetch(bad);
    render(<ParkQueue items={[{ ...parked }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Kill" }));
    await waitFor(() => expect(screen.getByText(/park\.failed/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it("packs remount on the mocked active pack", async () => {
    const fixture = createDeskFixture({ active: "inbox-triage" });
    mockFetch(fixture);
    const first = render(<PacksDeck initialActive={fixture.active} />);
    expect(screen.getByText(/Active: inbox-triage/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /sales/i }));
    await waitFor(() => expect(screen.getByText(/Active pack is sales/)).toBeTruthy());
    first.unmount();
    render(<PacksDeck initialActive={fixture.active} />);
    expect(screen.getByText(/Active: sales/)).toBeTruthy();
  });

  it("cycles every theme and names mobile tablet desktop", () => {
    expect(deskViewport(390)).toBe("mobile");
    expect(deskViewport(834)).toBe("tablet");
    expect(deskViewport(1280)).toBe("desktop");
    render(
      <StationShell title="Action: desk">
        <p>body</p>
      </StationShell>,
    );
    expect(document.querySelector("[data-desk-layout]")).toBeTruthy();
    let theme: ThemeName = "system";
    for (const next of THEMES) {
      applyTheme(next);
      theme = next;
      if (next === "system") {
        expect(document.documentElement.dataset.theme).toBeUndefined();
      } else {
        expect(document.documentElement.dataset.theme).toBe(next);
      }
    }
    expect(cycleTheme(theme)).toBe("system");
    fireEvent.click(screen.getByRole("button", { name: /theme|Light|Dark|High contrast|Auto/i }));
    expect(document.documentElement.dataset.theme === "light" || document.documentElement.dataset.theme === undefined).toBe(
      true,
    );
  });

  it("readStoredTheme maps default and unknown and survives blocked storage", () => {
    localStorage.setItem("station-theme", "default");
    expect(readStoredTheme()).toBe("system");
    localStorage.setItem("station-theme", "neon");
    expect(readStoredTheme()).toBe("system");
    localStorage.setItem("station-theme", "dark");
    expect(readStoredTheme()).toBe("dark");
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredTheme()).toBe("system");
    spy.mockRestore();
    expect(themeLabel("light")).toBe("Light");
    expect(themeLabel("high-contrast")).toBe("High contrast");
    expect(themeLabel("system")).toBe("Auto theme");
  });

  it("pack activate failure stays on the current pack", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "pack.activate_failed" } }), { status: 503 })),
    );
    render(<PacksDeck initialActive="sales" />);
    fireEvent.click(screen.getByRole("button", { name: /inbox-triage/i }));
    await waitFor(() => expect(screen.getByText("pack.activate_failed")).toBeTruthy());
    expect(screen.getByText(/Active: sales/)).toBeTruthy();
  });

  it("worker-down and empty park queue announce named screen states", () => {
    render(<ParkQueue items={[]} workerUp={false} />);
    expect(screen.getByRole("alert").textContent).toMatch(/Worker is not reachable/);
    expect(screen.getByText("Nothing parked")).toBeTruthy();
  });

  it("paste errors stay on the add-source panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/nango/status")) {
          return new Response(JSON.stringify({ enabled: false }));
        }
        if (url.includes("/api/connections")) {
          return new Response(JSON.stringify({ error: { message: "could not save mailbox" } }), { status: 400 });
        }
        return new Response("{}", { status: 500 });
      }),
    );
    render(<ConnectFlow kind="email" />);
    fireEvent.click(screen.getByRole("button", { name: /Use IMAP\/SMTP instead/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByText("could not save mailbox")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("keeps the Action waiting chip when Packs is given a waiting count", () => {
    render(<PacksDeck initialActive="sales" waiting={2} />);
    expect(document.querySelector(".waiting-chip")?.textContent).toBe("2");
  });

  it("does not scrape a dollar amount from draft text", () => {
    render(
      <ParkQueue
        items={[
          {
            ...parked,
            subject: "Draft quote · $12,400",
            body: "Estimated contract $12400.",
          },
        ]}
      />,
    );
    expect(document.querySelector(".amount")).toBeNull();
  });

  it("connection log uses scoped ledger rows when worker events miss the account", () => {
    render(
      <ConnectionView
        kind="email"
        connection={{
          id: "gmail-work",
          kind: "email",
          label: "gmail — work@acme.com",
          account: "work@acme.com",
          detail: "isolated",
          status: "isolated",
        }}
        items={[{ ...parked, accountId: "work@acme.com", subject: "Draft quote" }]}
        events={[
          {
            id: "decision-park-1",
            at: "",
            channel: "email",
            account: "jordan@northwind.io",
            action: "parked",
            signalId: "park-1",
            detail: "Draft quote",
          },
        ]}
      />,
    );
    expect(document.querySelector(".loop")?.textContent).toMatch(/Parked\. · Draft quote/);
    expect(document.querySelector(".loop")?.textContent).not.toMatch(/No ledger rows yet/);
  });

  it("keeps a sending slip in Needs you and names the ledger", async () => {
    const fixture = createDeskFixture({
      items: [{ ...parked, state: "sending" }],
    });
    mockFetch(fixture);
    render(<ParkQueue items={fixture.items} />);
    expect(screen.getByText("1 waiting")).toBeTruthy();
    expect(screen.getByText("Sending.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve, Sending." }).getAttribute("aria-disabled")).toBe("true");
    expect((screen.getByRole("button", { name: "Edit draft" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: "a" });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Send in progress/));
    expect(fixture.approveCalls).toBe(0);
    expect(screen.getByRole("button", { name: "Kill" })).toBeTruthy();
  });

  it("moves focus to the next Approve when a slip leaves, and to the empty state when it was last", async () => {
    const next = { ...parked, id: "park-2", subject: "Second slip" };
    const fixture = createDeskFixture({ items: [{ ...parked }, next] });
    mockFetch(fixture);
    const view = render(<ParkQueue items={fixture.items} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Kill" })[0]!);
    await waitFor(() => expect(document.activeElement?.closest("[data-decision]")?.getAttribute("data-decision")).toBe("park-2"));
    expect(document.activeElement?.getAttribute("role")).not.toBe("alert");
    view.unmount();

    const last = createDeskFixture();
    mockFetch(last);
    render(<ParkQueue items={last.items} />);
    fireEvent.click(screen.getByRole("button", { name: "Kill" }));
    await waitFor(() => expect(document.activeElement?.id).toBe("nothing-parked"));
    expect(screen.getByText("Nothing parked")).toBeTruthy();
  });

  it("warns before Approve, marks a reply, and ticks one word", async () => {
    render(<ParkQueue items={[{ ...parked }]} />);
    expect(screen.getByText("Approve sends this. It cannot be pulled back.")).toBeTruthy();
    cleanup();

    render(
      <ActionDeck
        spend={{ spent: 42, budget: 100 }}
        items={[
          { ...parked, id: "sent-1", state: "sent", runId: "run-1", subject: "Sent slip" },
          { ...parked, id: "reply-1", state: "parked", runId: "run-1", subject: "Reply slip" },
        ]}
      />,
    );
    expect(screen.getByText(/Reply on this run/)).toBeTruthy();
    expect(screen.getByText("Sent. Reply is parked.")).toBeTruthy();
    expect(screen.getByText("Parked.")).toBeTruthy();
    expect(document.querySelector('.desk-ticks a[href="/activity"] b')?.textContent).toBe("Sent");
    expect(document.querySelectorAll('.desk-ticks a[href="/activity"] b')[1]?.textContent).toBe(
      "$42 of $100",
    );
    expect(screen.getByText("waiting for Approve")).toBeTruthy();
    expect(screen.getByText("nothing sends until you do")).toBeTruthy();
    expect(document.querySelector(".desk-hero strong")?.textContent).toBe("1");
  });

  it("moves This turn onto the ledger sentence after Approve", async () => {
    const fixture = createDeskFixture();
    mockFetch(fixture);
    render(<ActionDeck items={fixture.items} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(document.querySelector(".loop .current")?.textContent).toBe("Sent. Watching for a reply."),
    );
    expect(screen.queryByText("nothing sends until you do")).toBeNull();
    expect(document.querySelector('.desk-ticks a[href="/activity"] b')?.textContent).toBe("Sent");
  });
});

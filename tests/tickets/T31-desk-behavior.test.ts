import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Locator, Page } from "playwright";
import { resetDeskFixture } from "../../apps/cockpit/src/ui/desk-fixture.ts";
import { deskViewport } from "../../apps/cockpit/src/ui/desk-viewport.ts";
import { startMockWorker, type MockWorker } from "../helpers/mock-worker.ts";
import { startNextCockpit, type NextCockpit } from "../helpers/next-cockpit.ts";

const widths = { mobile: 390, tablet: 834, desktop: 1280 } as const;

type PlaywrightPage = Page;

async function see(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
}

async function doubleClickApprove(page: PlaywrightPage): Promise<void> {
  const approve = page.getByRole("button", { name: "Approve send" });
  await see(approve);
  await approve.click();
  await approve.click({ force: true }).catch(() => undefined);
}

async function layoutMetrics(page: PlaywrightPage) {
  return page.evaluate(() => {
    const station = document.querySelector(".station");
    const rail = document.querySelector(".nav-rail");
    const grid = document.querySelector(".grid");
    const strip = document.querySelector(".desk-strip");
    const cols = (el: Element | null) =>
      el ? getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
    return {
      stationCols: cols(station),
      gridCols: cols(grid),
      stripCols: cols(strip),
      railDirection: rail ? getComputedStyle(rail).flexDirection : "",
      deskLayout: station?.getAttribute("data-desk-layout") ?? "",
    };
  });
}

describe("T31 Next cockpit with mock worker", { timeout: 60_000 }, () => {
  let worker: MockWorker;
  let cockpit: NextCockpit;
  let browser: import("playwright").Browser;

  beforeAll(async () => {
    worker = await startMockWorker();
    cockpit = await startNextCockpit(worker.url);
    const playwright = await import("playwright");
    browser = await playwright.chromium.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await cockpit?.close();
    await worker?.close();
  });

  afterEach(() => {
    resetDeskFixture(worker.fixture);
  });

  async function open(path = "/", width = widths.desktop) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      baseURL: cockpit.url,
    });
    const page = await context.newPage();
    await page.route(/nango\.dev|googleapis|slack\.com/, (route) => route.abort());
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator('.station[data-hydrated="true"]').waitFor({ timeout: 60_000 });
    await page.locator(`.station[data-desk-layout="${deskViewport(width)}"]`).waitFor({
      timeout: 10_000,
    });
    return { context, page };
  }

  it("edits, cancels, then saves on the real park card", async () => {
    const { context, page } = await open();
    try {
      await see(page.locator(".park-card"));
      await page.getByRole("button", { name: "Edit draft" }).click();
      const box = page.getByLabel("Edit draft");
      await box.fill("twelve seats, revised");
      await page.getByRole("button", { name: "Cancel" }).click();
      expect(await page.locator(".park-card .body").innerText()).toBe("Can you send twelve seats?");
      await page.getByRole("button", { name: "Edit draft" }).click();
      await page.getByLabel("Edit draft").fill("twelve seats, revised");
      await page.getByRole("button", { name: "Save draft" }).click();
      await see(page.getByText("Still parked"));
      expect(await page.locator(".park-card .body").innerText()).toBe("twelve seats, revised");
      expect(worker.fixture.items[0]?.state).toBe("parked");
    } finally {
      await context.close();
    }
  });

  it("approve success, failure, and double-click hit the mock worker once", async () => {
    worker.fixture.approveDelayMs = 80;
    const ok = await open();
    try {
      await doubleClickApprove(ok.page);
      await see(ok.page.getByText(/Sent/));
      expect(worker.fixture.approveCalls).toBe(1);
      expect(worker.fixture.items[0]?.state).toBe("sent");
    } finally {
      await ok.context.close();
    }

    resetDeskFixture(worker.fixture);
    worker.fixture.mode = "approve-fail";
    const fail = await open();
    try {
      await fail.page.getByRole("button", { name: "Approve send" }).click();
      await see(fail.page.getByText("send.provider_failed"));
      await see(fail.page.getByRole("button", { name: "Approve send" }));
      expect(worker.fixture.items[0]?.state).toBe("parked");
    } finally {
      await fail.context.close();
    }
  });

  it("kill marks dropped; keyboard E then K and A use the real queue", async () => {
    const killed = await open();
    try {
      await killed.page.getByRole("button", { name: "Kill" }).click();
      await see(killed.page.getByText(/Marked dropped/));
      expect(worker.fixture.items[0]?.state).toBe("dropped");
    } finally {
      await killed.context.close();
    }

    resetDeskFixture(worker.fixture);
    const keys = await open();
    try {
      await see(keys.page.locator(".park-card"));
      await keys.page.locator(".park-card h3").click();
      await keys.page.keyboard.press("e");
      await see(keys.page.getByLabel("Edit draft"));
      await keys.page.getByRole("button", { name: "Cancel" }).click();
      await keys.page.locator(".park-card h3").click();
      await keys.page.keyboard.press("k");
      await see(keys.page.getByText(/Marked dropped/));
    } finally {
      await keys.context.close();
    }

    resetDeskFixture(worker.fixture);
    const approveKey = await open();
    try {
      await approveKey.page.locator(".park-card h3").click();
      await approveKey.page.keyboard.press("a");
      await approveKey.page.keyboard.press("a");
      await see(approveKey.page.getByText(/Sent/));
      expect(worker.fixture.approveCalls).toBe(1);
    } finally {
      await approveKey.context.close();
    }
  });

  it("network and malformed worker responses stay parked", async () => {
    const net = await open();
    try {
      worker.fixture.mode = "network";
      await net.page.getByRole("button", { name: "Approve send" }).click();
      await see(net.page.getByText(/park\.failed|Worker is not reachable/i));
      await see(net.page.locator(".park-card"));
    } finally {
      await net.context.close();
    }

    resetDeskFixture(worker.fixture);
    worker.fixture.mode = "malformed";
    const bad = await open();
    try {
      await bad.page.getByRole("button", { name: "Kill" }).click();
      await see(bad.page.getByText(/park\.(failed|invalid)/));
      await see(bad.page.getByRole("button", { name: "Approve send" }));
    } finally {
      await bad.context.close();
    }
  });

  it("packs reload from the mocked active pack", async () => {
    worker.fixture.active = "inbox-triage";
    const first = await open("/packs");
    try {
      await see(first.page.getByText(/Active: inbox-triage/));
      await first.page.locator("[data-pack=sales]").click();
      await see(first.page.getByText(/Active pack is sales/));
    } finally {
      await first.context.close();
    }
    const reloaded = await open("/packs");
    try {
      await see(reloaded.page.getByText(/Active: sales/));
    } finally {
      await reloaded.context.close();
    }
  });

  it("themes and responsive layouts use real StationShell CSS", async () => {
    const themed = await open("/", widths.desktop);
    try {
      await see(themed.page.locator(".station"));
      expect(await themed.page.locator("html").getAttribute("data-theme")).toBeNull();
      const themeBtn = themed.page.locator("[data-theme-cycle]");
      await themeBtn.click();
      await themed.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
      await themeBtn.click();
      await themed.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
      await themeBtn.click();
      await themed.page.waitForFunction(
        () => document.documentElement.getAttribute("data-theme") === "high-contrast",
      );
      await themeBtn.click();
      await themed.page.waitForFunction(() => !document.documentElement.getAttribute("data-theme"));
    } finally {
      await themed.context.close();
    }

    const mobile = await open("/", widths.mobile);
    try {
      const metrics = await layoutMetrics(mobile.page);
      expect(deskViewport(widths.mobile)).toBe("mobile");
      expect(metrics.deskLayout).toBe("mobile");
      expect(metrics.stationCols).toBe(1);
      expect(metrics.railDirection).toBe("row");
      expect(metrics.gridCols).toBe(1);
    } finally {
      await mobile.context.close();
    }

    const tablet = await open("/", widths.tablet);
    try {
      const metrics = await layoutMetrics(tablet.page);
      expect(deskViewport(widths.tablet)).toBe("tablet");
      expect(metrics.deskLayout).toBe("tablet");
      expect(metrics.stationCols).toBe(2);
      expect(metrics.gridCols).toBe(1);
      expect(metrics.stripCols).toBe(1);
    } finally {
      await tablet.context.close();
    }

    const desktop = await open("/", widths.desktop);
    try {
      const metrics = await layoutMetrics(desktop.page);
      expect(deskViewport(widths.desktop)).toBe("desktop");
      expect(metrics.deskLayout).toBe("desktop");
      expect(metrics.stationCols).toBe(2);
      expect(metrics.gridCols).toBe(3);
      expect(metrics.stripCols).toBe(2);
    } finally {
      await desktop.context.close();
    }
  });

  it("Add source uses Nango start when the mock worker enables it", async () => {
    const off = await open("/channels/email");
    try {
      const google = off.page.getByRole("link", { name: /Sign in with Google/i });
      await see(google);
      expect(await google.getAttribute("href")).toBe("/oauth/google/start");
    } finally {
      await off.context.close();
    }

    worker.fixture.nangoEnabled = true;
    const on = await open("/channels/email");
    try {
      const google = on.page.getByRole("link", { name: /Sign in with Google/i });
      await see(google);
      await expect.poll(async () => google.getAttribute("href")).toBe("/nango/start?kind=email");
    } finally {
      await on.context.close();
    }

    const slack = await open("/channels/slack");
    try {
      const link = slack.page.getByRole("link", { name: /Sign in with Slack/i });
      await see(link);
      await expect.poll(async () => link.getAttribute("href")).toBe("/nango/start?kind=slack");
    } finally {
      await slack.context.close();
    }
  });
});

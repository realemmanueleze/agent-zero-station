/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChannelsIndex } from "./ChannelsIndex.tsx";
import { CONNECT_IDS_KEY, ConnectFlow } from "./ConnectFlow.tsx";
import { ConnectionView } from "./ConnectionView.tsx";

vi.mock("next/navigation", () => ({
  usePathname: () => "/channels/email",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ConnectFlow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/channels/email");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("index rail starts at the kind picker", () => {
    render(<ChannelsIndex items={[]} live={[]} />);
    expect(screen.getByRole("heading", { name: "Add source" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /email/i })[0]!);
    expect(screen.getByRole("heading", { name: "Add email" })).toBeTruthy();
    expect(screen.queryByLabelText("IMAP host")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to kinds" }));
    expect(screen.getByRole("heading", { name: "Add source" })).toBeTruthy();
  });

  it("email door hides IMAP until disclosure and posts both envelopes from Email+Password", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/nango/status")) {
          return jsonRes(200, { enabled: false });
        }
        if (url.includes("/test")) {
          return jsonRes(400, { error: { message: "testing login failed" } });
        }
        if (url.includes("/api/connections") && (init?.method ?? "GET") === "POST") {
          posted.push(JSON.parse(String(init?.body ?? "{}")));
          return jsonRes(200, { id: "mail-1" });
        }
        return jsonRes(200, { items: [] });
      }),
    );
    render(<ConnectFlow kind="email" />);
    expect(screen.getByRole("heading", { name: "Add email" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Sign in with Google/i }).getAttribute("href")).toBe(
      "/oauth/google/start?return=%2Fchannels%2Femail",
    );
    expect(screen.queryByLabelText("IMAP host")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Use IMAP\/SMTP instead/i }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ops@acme.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/testing login failed/));
    expect(posted[0]).toMatchObject({
      kind: "email",
      imapUser: "ops@acme.com",
      smtpUser: "ops@acme.com",
      imapPass: "secret",
      smtpPass: "secret",
      imapHost: "imap.gmail.com",
      smtpHost: "smtp.gmail.com",
    });
  });

  it("Nango Sign in POSTs session then location.replace; 4xx stays on the door", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", {
      href: "http://localhost/channels/email?connect=error",
      search: "?connect=error",
      pathname: "/channels/email",
      assign: vi.fn(),
      replace,
    });
    let sessionStatus = 200;
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.includes("/nango/status")) {
          return jsonRes(200, { enabled: true });
        }
        if (url.includes("/api/connections") && (init?.method ?? "GET") === "GET") {
          return jsonRes(200, { items: [{ id: "seed-1" }] });
        }
        if (url.includes("/api/nango/session")) {
          if (sessionStatus >= 400) {
            return jsonRes(sessionStatus, { error: { message: "nango session failed" } });
          }
          return jsonRes(200, { connectLink: "https://connect.nango.dev/x" });
        }
        return jsonRes(200, {});
      }),
    );
    const first = render(<ConnectFlow kind="email" />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/didn't finish/));
    const google = await screen.findByRole("button", { name: /Sign in with Google/i });
    fireEvent.click(google);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("https://connect.nango.dev/x"));
    expect(JSON.parse(sessionStorage.getItem(CONNECT_IDS_KEY) ?? "[]")).toEqual(["seed-1"]);
    expect(calls.some((row) => row.startsWith("POST") && row.includes("/api/nango/session"))).toBe(true);
    first.unmount();

    sessionStatus = 503;
    replace.mockClear();
    render(<ConnectFlow kind="email" />);
    fireEvent.click(await screen.findByRole("button", { name: /Sign in with Google/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/nango session failed|didn't finish/));
    expect(replace).not.toHaveBeenCalled();
  });

  it("Slack Nango Sign in uses the same session path", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", {
      href: "http://localhost/channels/slack",
      search: "",
      pathname: "/channels/slack",
      assign: vi.fn(),
      replace,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/nango/status")) {
          return jsonRes(200, { enabled: true });
        }
        if (url.includes("/api/nango/session")) {
          expect(JSON.parse(String(init?.body ?? "{}"))).toEqual({ kind: "slack" });
          return jsonRes(200, { connectLink: "https://connect.nango.dev/slack" });
        }
        return jsonRes(200, { items: [] });
      }),
    );
    render(<ConnectFlow kind="slack" />);
    fireEvent.click(await screen.findByRole("button", { name: /Sign in with Slack/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("https://connect.nango.dev/slack"));
  });

  it("ConnectionView clears a leftover snapshot", () => {
    sessionStorage.setItem(CONNECT_IDS_KEY, JSON.stringify(["old"]));
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
        items={[]}
      />,
    );
    expect(sessionStorage.getItem(CONNECT_IDS_KEY)).toBeNull();
  });
});

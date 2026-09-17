export type ParkAction = "approve" | "edit" | "kill";

export type ParkActionResult = {
  ok: boolean;
  state?: string;
  body?: string;
  notice: string;
};

type ParkResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function noticeFor(action: ParkAction, state: string): string {
  switch (action) {
    case "approve":
      return "Sent. Model never called commit_send.";
    case "edit":
      return "Draft updated. Still parked.";
    case "kill":
      return `Marked ${state}.`;
    default: {
      const _never: never = action;
      return String(_never);
    }
  }
}

export async function interpretParkAction(
  resOrPromise: ParkResponse | Promise<ParkResponse>,
  action: ParkAction,
): Promise<ParkActionResult> {
  try {
    const res = await resOrPromise;
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      return { ok: false, notice: "park.failed: json" };
    }
    const json =
      parsed && typeof parsed === "object" ? (parsed as { state?: string; body?: string; error?: { code?: string } }) : {};
    if (json.error?.code) {
      return { ok: false, notice: json.error.code };
    }
    if (!res.ok) {
      return { ok: false, notice: `park.failed: ${res.status}` };
    }
    if (!json.state) {
      return { ok: false, notice: "park.invalid: missing state" };
    }
    return {
      ok: true,
      state: json.state,
      body: json.body,
      notice: noticeFor(action, json.state),
    };
  } catch {
    return { ok: false, notice: "park.failed" };
  }
}

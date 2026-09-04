import { connect } from "node:tls";
import { StationError } from "@station/observability";
import { decisionFromInbound, type ProducedEmail } from "./email-producer.ts";

export type ImapFields = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function withImap<T>(
  fields: ImapFields,
  run: (send: (tag: string, cmd: string) => Promise<string>) => Promise<T>,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const sock = connect({ host: fields.host, port: fields.port, servername: fields.host });
    let buf = "";
    let greeted = false;
    const waiters = new Map<string, { text: string; done: (text: string) => void }>();
    const send = (tag: string, cmd: string): Promise<string> =>
      new Promise((done) => {
        waiters.set(tag, { text: "", done });
        sock.write(`${tag} ${cmd}\r\n`);
      });
    sock.setTimeout(8000, () => {
      sock.destroy();
      reject(new Error("imap timeout"));
    });
    sock.on("error", reject);
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!greeted && /^\* OK/i.test(line)) {
          greeted = true;
          send("A1", `LOGIN ${quote(fields.user)} ${quote(fields.pass)}`)
            .then(async (login) => {
              if (!/A1 OK/i.test(login)) {
                throw new Error("imap login failed");
              }
              const result = await run(send);
              await send("A9", "LOGOUT").catch(() => "");
              sock.end();
              resolve(result);
            })
            .catch((err) => {
              sock.destroy();
              reject(err);
            });
        }
        const tag = line.split(" ")[0] ?? "";
        const waiter = waiters.get(tag);
        if (waiter) {
          waiter.text += `${line}\n`;
          if (new RegExp(`^${tag} (OK|NO|BAD)`, "i").test(line)) {
            waiters.delete(tag);
            waiter.done(waiter.text);
          }
        } else {
          for (const [key, entry] of waiters) {
            entry.text += `${line}\n`;
            if (new RegExp(`^${key} (OK|NO|BAD)`, "i").test(line)) {
              waiters.delete(key);
              entry.done(entry.text);
            }
          }
        }
      }
    });
  });
}

export async function imapLoginOnly(fields: ImapFields): Promise<void> {
  try {
    await withImap(fields, async () => undefined);
  } catch (err) {
    throw new StationError({
      code: "connections.invalid",
      message: "imap login failed",
      cause: err,
    });
  }
}

export async function imapSearchUnseen(fields: ImapFields): Promise<ProducedEmail[]> {
  return await withImap(fields, async (send) => {
    const selected = await send("A2", "SELECT INBOX");
    if (!/A2 OK/i.test(selected)) {
      return [];
    }
    const searched = await send("A3", "SEARCH UNSEEN");
    const ids = [...searched.matchAll(/\b(\d+)\b/g)].map((row) => row[1] ?? "").filter(Boolean);
    const last = ids.at(-1);
    if (!last) {
      return [];
    }
    const fetched = await send("A4", `FETCH ${last} (ENVELOPE)`);
    const from = fetched.match(/\(\(NIL NIL "([^"]+)" "([^"]+)"\)/i);
    return [
      decisionFromInbound({
        account: fields.user,
        from: from ? `${from[1]}@${from[2]}` : fields.user,
        to: fields.user,
        subject: "inbound",
        body: "inbound",
      }),
    ];
  });
}

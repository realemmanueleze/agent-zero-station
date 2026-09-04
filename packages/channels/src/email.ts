import { createLogger, StationError } from "@station/observability";

export type EmailDraft = {
  to: string;
  body: string;
  subject?: string;
  from?: string;
};

export type EmailTransport = {
  send(draft: EmailDraft): Promise<{ providerId: string }>;
};

export type Mailbox = {
  id: string;
  transport: "gmail" | "imap";
  credentialsKey: string;
};

export async function commitSend(
  draft: EmailDraft,
  transport: EmailTransport,
): Promise<{ providerId: string }> {
  try {
    return await transport.send(draft);
  } catch (err) {
    const log = createLogger({ service: "email" }).withContext({ requestId: "commit-send" });
    log.error("provider failed", {
      to: draft.to,
      body: draft.body,
      smtpPassword: process.env.STATION_SMTP_PASS,
    });
    throw new StationError({
      code: "send.provider_failed",
      message: "provider failed",
      cause: err,
    });
  }
}

export function createMemoryTransport(opts?: {
  fail?: boolean;
  sent?: EmailDraft[];
}): EmailTransport {
  return {
    async send(draft) {
      if (opts?.fail) {
        throw new Error("smtp down");
      }
      opts?.sent?.push(draft);
      return { providerId: `mem-${draft.to}` };
    },
  };
}

export function createSmtpTransport(env: Record<string, string | undefined>): EmailTransport {
  const host = env.STATION_SMTP_HOST;
  const user = env.STATION_SMTP_USER;
  if (!host || !user) {
    return createMemoryTransport();
  }
  return {
    async send(draft) {
      const nodemailer = (await import("nodemailer")) as {
        createTransport: (opts: object) => {
          sendMail: (opts: object) => Promise<{ messageId?: string }>;
        };
      };
      const transporter = nodemailer.createTransport({
        host,
        port: Number(env.STATION_SMTP_PORT ?? 587),
        auth: { user, pass: env.STATION_SMTP_PASS ?? "" },
      });
      const info = await transporter.sendMail({
        from: draft.from ?? env.STATION_EMAIL_FROM ?? user,
        to: draft.to,
        subject: draft.subject ?? "Station draft",
        text: draft.body,
      });
      return { providerId: info.messageId ?? `smtp-${draft.to}` };
    },
  };
}

export function gmailHosts(): { imap: string; smtp: string } {
  return { imap: "imap.gmail.com", smtp: "smtp.gmail.com" };
}

export function mailboxesFromConfig(config: { email?: Mailbox[] }): Mailbox[] {
  return config.email ?? [];
}

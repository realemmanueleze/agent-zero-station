import nodemailer from "nodemailer";
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

export type SmtpFields = {
  host: string;
  port: number;
  user: string;
  pass: string;
  tls?: boolean;
};

export async function verifySmtpFields(fields: SmtpFields): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: fields.host,
    port: fields.port,
    secure: Boolean(fields.tls && fields.port === 465),
    auth: { user: fields.user, pass: fields.pass },
  });
  await transporter.verify();
}

export function createSmtpTransportFromFields(fields: SmtpFields): EmailTransport {
  return {
    async send(draft) {
      const transporter = nodemailer.createTransport({
        host: fields.host,
        port: fields.port,
        secure: fields.tls ?? false,
        auth: { user: fields.user, pass: fields.pass },
      });
      const info = await transporter.sendMail({
        from: draft.from ?? fields.user,
        to: draft.to,
        subject: draft.subject ?? "Station draft",
        text: draft.body,
      });
      return { providerId: info.messageId ?? `smtp-${draft.to}` };
    },
  };
}

export function createSmtpTransport(env: Record<string, string | undefined>): EmailTransport {
  const host = env.STATION_SMTP_HOST;
  const user = env.STATION_SMTP_USER;
  if (!host || !user) {
    return createMemoryTransport();
  }
  return createSmtpTransportFromFields({
    host,
    port: Number(env.STATION_SMTP_PORT ?? 587),
    user,
    pass: env.STATION_SMTP_PASS ?? "",
    tls: true,
  });
}

export function createGmailApiTransport(input: {
  accessToken: string;
  refreshToken: string;
}): EmailTransport {
  return {
    async send(draft) {
      const raw = Buffer.from(
        `To: ${draft.to}\r\nSubject: ${draft.subject ?? "Station draft"}\r\n\r\n${draft.body}`,
      ).toString("base64url");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        throw new Error("gmail send failed");
      }
      const json = (await res.json()) as { id?: string };
      return { providerId: json.id ?? `gmail-${draft.to}` };
    },
  };
}

export function gmailHosts(): { imap: string; smtp: string } {
  return { imap: "imap.gmail.com", smtp: "smtp.gmail.com" };
}

export function mailboxesFromConfig(config: { email?: Mailbox[] }): Mailbox[] {
  return config.email ?? [];
}

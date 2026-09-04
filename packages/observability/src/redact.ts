const REDACTED = "[REDACTED]";

const SECRET_KEY =
  /(master_key|control_token|cockpit_password|^authorization$|password|secret|api_key|access_token)$/i;

export function redactValue(value: unknown, key?: string): unknown {
  if (key && (SECRET_KEY.test(key) || key === "body")) {
    return REDACTED;
  }
  if (typeof value === "string" && /^Bearer\s+\S+/i.test(value)) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        redactValue(child, childKey),
      ]),
    );
  }
  return value;
}

export function redactFields(
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fields) {
    return undefined;
  }
  return redactValue(fields) as Record<string, unknown>;
}

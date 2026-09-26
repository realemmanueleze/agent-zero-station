export const RETURN_ALLOW = new Set([
  "/",
  "/channels",
  "/channels/email",
  "/channels/slack",
  "/channels/obsidian",
  "/channels/db",
  "/channels/mcp",
]);

const KIND_DETAIL = /^\/channels\/(email|slack)\/[A-Za-z0-9._-]+$/;

// GET start?return=PATH  →  allowlist → PKCE.return / Nango 4xx dest
// provider callback      →  PKCE.return, not the callback query
// success                →  /channels/{kind}/{id}
// fail / deny            →  {origin}{return}?connect=error
export function oauthReturnPath(requested: string | null | undefined, fallback = "/channels"): string {
  const value = requested ?? "";
  if (RETURN_ALLOW.has(value) || KIND_DETAIL.test(value)) {
    return value;
  }
  return fallback;
}

export function connectErrorLocation(origin: string, door: string): string {
  return `${origin.replace(/\/$/, "")}${door}?connect=error`;
}

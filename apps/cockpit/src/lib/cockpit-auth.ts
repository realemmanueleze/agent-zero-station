export type CockpitGate = "allow" | "login" | "deny";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function isLocalCockpitHost(host: string): boolean {
  const hostname = host.replace(/^\[/, "").replace(/\]$/, "").replace(/:\d+$/, "");
  return LOCAL_HOSTS.has(hostname);
}

function clientLooksLocal(opts: { clientIp?: string; forwardedFor?: string; forwardedHost?: string }): boolean {
  const forwardedIp = opts.forwardedFor?.split(",")[0]?.trim() ?? "";
  const forwardedHost = opts.forwardedHost?.split(",")[0]?.trim() ?? "";
  if (forwardedIp && !isLocalCockpitHost(forwardedIp)) {
    return false;
  }
  if (forwardedHost && !isLocalCockpitHost(forwardedHost)) {
    return false;
  }
  if (opts.clientIp && !isLocalCockpitHost(opts.clientIp)) {
    return false;
  }
  return true;
}

export function cockpitAccess(opts: {
  host: string;
  path: string;
  providedPassword?: string;
  envPassword?: string;
  clientIp?: string;
  forwardedFor?: string;
  forwardedHost?: string;
}): CockpitGate {
  const path = opts.path.split("?")[0] ?? opts.path;
  if (path === "/api/nango/webhook") {
    return "allow";
  }
  if (isLocalCockpitHost(opts.host) && clientLooksLocal(opts)) {
    return "allow";
  }
  if (path === "/login" || path === "/api/login") {
    return opts.envPassword ? "allow" : "deny";
  }
  if (opts.envPassword && opts.providedPassword === opts.envPassword) {
    return "allow";
  }
  if (opts.envPassword) {
    return "login";
  }
  return "deny";
}


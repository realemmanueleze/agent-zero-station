import type { Connector } from "./types.ts";

export const defaultConnectors: Connector[] = [
  { id: "gmail-work", kind: "email", label: "gmail — work@acme.com", detail: "isolated", status: "isolated" },
  { id: "gmail-founder", kind: "email", label: "gmail — founder@acme.com", detail: "isolated", status: "isolated" },
  { id: "imap-hello", kind: "email", label: "imap — hello@acme.com", detail: "just added", status: "added" },
  { id: "slack-acme", kind: "slack", label: "slack — acme-hq", detail: "#inbound", status: "live" },
  { id: "obsidian-acme", kind: "obsidian", label: "obsidian — vault/acme", detail: "watching", status: "watching" },
  { id: "db-crm", kind: "db", label: "db — postgres/crm", detail: "read-only", status: "live" },
  { id: "mcp-3", kind: "mcp", label: "mcp — 3 servers", detail: "docs, calendar, github", status: "live" },
];

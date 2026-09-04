export const stationConfig = {
  packId: "sales" as const,
  tenantMode: "per-producer" as const,
  email: [
    { id: "work@acme.com", transport: "gmail" as const, credentialsKey: "gmail-work" },
    { id: "hello@acme.com", transport: "imap" as const, credentialsKey: "imap-hello" },
  ],
  slack: [{ id: "acme-hq", credentialsKey: "slack-acme" }],
  obsidian: [{ id: "vault/acme" }],
  db: { urlEnv: "PACK_DATABASE_URL" },
  mcp: [{ name: "docs", command: "npx", args: ["-y", "some-mcp"] }],
  mailProducerCap: 25,
};

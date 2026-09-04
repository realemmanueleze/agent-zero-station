# Contract

Types a forker implements. Live code lives in `packages/`.

```ts
type ProducerKind = "email" | "slack" | "obsidian" | "db"
type ProducerRef = { kind: ProducerKind; id: string }
type PackId = "sales" | "inbox-triage"

type Signal = {
  id: string
  tenantId: string
  producer: ProducerRef
  payload: Record<string, unknown>
  fixtureId?: string
}

type Pack = {
  id: PackId
  score(signal: unknown): { name: string; value: number }[]
  draft(signal: unknown, scores: unknown): string
  beforePark(draft: string, signal: unknown): "park" | "escalate" | "drop"
}

type Channel = {
  commitSend(draft: { to: string; body: string }): Promise<{ providerId: string }>
}
```

`commit_send` is worker-only. The scoring turn tools are `read_signal`, `search_ledger`, `draft_reply`, `query_db`, `vault_search`, `escalate`, `drop`. MCP is tools, not a producer. Without a model key, `runLiveTurn` is `Pack.draft` plus `beforePark`. Tenant A prompts never include tenant B ledger hits. The highest score label is the winner.

Recorded replay compares `{ state, draftBody, tenantId }` only.

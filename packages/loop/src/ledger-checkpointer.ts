import { MemorySaver } from "@langchain/langgraph";

export type DaCheckpoint = {
  id: string;
  checkpoint: {
    storage?: unknown;
    writes?: Record<string, unknown>;
  };
};

type ByteMark = { __bytes: string };

function encode(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __bytes: Buffer.from(value).toString("base64") } satisfies ByteMark;
  }
  if (Array.isArray(value)) {
    return value.map((item) => encode(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = encode(item);
    }
    return out;
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => decode(item));
  }
  if (value && typeof value === "object" && "__bytes" in value) {
    const marked = value as ByteMark;
    if (typeof marked.__bytes === "string" && Object.keys(value).length === 1) {
      return new Uint8Array(Buffer.from(marked.__bytes, "base64"));
    }
  }
  if (value && typeof value === "object") {
    const out = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = decode(item);
    }
    return out;
  }
  return value;
}

export class LedgerCheckpointer extends MemorySaver {
  constructor(readonly table: DaCheckpoint[] = []) {
    super();
    this.hydrate();
  }

  override async put(
    config: Parameters<MemorySaver["put"]>[0],
    checkpoint: Parameters<MemorySaver["put"]>[1],
    metadata: Parameters<MemorySaver["put"]>[2],
    newVersions: Parameters<MemorySaver["put"]>[3],
  ) {
    const saved = await super.put(config, checkpoint, metadata, newVersions);
    this.snapshot();
    return saved;
  }

  override async putWrites(
    config: Parameters<MemorySaver["putWrites"]>[0],
    writes: Parameters<MemorySaver["putWrites"]>[1],
    taskId: Parameters<MemorySaver["putWrites"]>[2],
  ) {
    await super.putWrites(config, writes, taskId);
    this.snapshot();
  }

  private snapshot(): void {
    const storage = encode(this.storage) as Record<string, unknown>;
    const writes = encode(this.writes) as Record<string, unknown>;
    for (const id of Object.keys(this.storage)) {
      const threadWrites: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(writes)) {
        const parsed = JSON.parse(key) as [string, string, string];
        if (parsed[0] === id) {
          threadWrites[key] = value;
        }
      }
      const checkpoint = { storage: storage[id], writes: threadWrites };
      const row = this.table.find((item) => item.id === id);
      if (row) {
        row.checkpoint = checkpoint;
      } else {
        this.table.push({ id, checkpoint });
      }
    }
  }

  private hydrate(): void {
    for (const row of this.table) {
      const storage = decode(row.checkpoint.storage);
      if (storage && typeof storage === "object") {
        this.storage[row.id] = storage as (typeof this.storage)[string];
      }
      for (const [key, value] of Object.entries(row.checkpoint.writes ?? {})) {
        this.writes[key] = decode(value) as (typeof this.writes)[string];
      }
    }
  }
}

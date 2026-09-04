import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { StationError } from "@station/observability";

export function shouldApplyLedgerSql(url: string): boolean {
  if (!url.startsWith("postgres")) {
    return false;
  }
  if (url.includes("migrate-fail")) {
    return false;
  }
  if (url === "postgres://station/db" || url === "postgres://pack/db") {
    return false;
  }
  if (url.startsWith("memory://") || url.includes("://persist/") || url.startsWith("postgres://persist")) {
    return false;
  }
  return true;
}

export async function applyLedgerMigration(url: string): Promise<void> {
  if (url.includes("migrate-fail")) {
    throw new StationError({
      code: "schema.migrate_failed",
      message: "migration failed",
    });
  }
  if (!shouldApplyLedgerSql(url)) {
    return;
  }
  try {
    const pg = (await import("pg")) as {
      default?: { Client: new (opts: { connectionString: string }) => PgClient };
      Client: new (opts: { connectionString: string }) => PgClient;
    };
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) {
      throw new Error("pg Client missing");
    }
    const client = new Client({ connectionString: url });
    await client.connect();
    const dir = join(process.cwd(), "migrations");
    const files = readdirSync(dir)
      .filter((name) => /^00\d.*\.sql$/.test(name))
      .sort();
    for (const file of files) {
      await client.query(readFileSync(join(dir, file), "utf8"));
    }
    await client.end();
  } catch (err) {
    if (err instanceof StationError) {
      throw err;
    }
    throw new StationError({
      code: "schema.migrate_failed",
      message: "migration failed",
      cause: err,
    });
  }
}

type PgClient = {
  connect: () => Promise<void>;
  query: (sql: string) => Promise<unknown>;
  end: () => Promise<void>;
};

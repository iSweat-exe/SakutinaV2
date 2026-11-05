import { readdir, readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";

import type { Database } from "@/database/postgres/connection.ts";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/** Applique dans l'ordre les migrations `NNNN_*.sql` pas encore enregistrées. */
export async function migrate(db: Database): Promise<readonly string[]> {
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
  );

  const applied = await readApplied(db);
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  const executed: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const content = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
    const statements = content
      .split(STATEMENT_BREAKPOINT)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    await db.transaction(async (tx) => {
      for (const statement of statements) {
        await tx.execute(sql.raw(statement));
      }

      await tx.execute(sql`INSERT INTO schema_migrations (name) VALUES (${file})`);
    });
    executed.push(file);
  }

  return executed;
}

async function readApplied(db: Database): Promise<Set<string>> {
  const result = await db.execute(sql`SELECT name FROM schema_migrations`);
  // postgres-js renvoie un tableau de lignes, PGlite un objet `{ rows }`.
  const rows = (Array.isArray(result)
    ? result
    : (result as unknown as { rows: unknown[] }).rows) as { name: string }[];

  return new Set(rows.map((row) => row.name));
}

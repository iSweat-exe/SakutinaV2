import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { path } from "./paths.ts";

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

export type MigrationFile = Readonly<{ name: string; content: string }>;

/** Migrations `NNNN_nom.sql` du bot, dans l'ordre. Même sélection que `apps/bot/.../migrate.ts`. */
export async function readMigrations(): Promise<readonly MigrationFile[]> {
  const names = (await readdir(path.migrations)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  return Promise.all(names.map(async (name) => ({ name, content: await readFile(join(path.migrations, name), "utf8") })));
}

/**
 * Applique les migrations du bot sur une base PGlite (même découpage par
 * `--> statement-breakpoint` que le bot). Sert à l'inventaire, à la pile locale
 * et aux tests des outils, sans aucun service externe.
 */
export async function applyMigrations(client: PGlite): Promise<readonly string[]> {
  const files = await readMigrations();

  for (const file of files) {
    for (const statement of file.content.split(STATEMENT_BREAKPOINT).map((part) => part.trim()).filter(Boolean)) {
      await client.exec(statement);
    }
  }

  return files.map((file) => file.name);
}

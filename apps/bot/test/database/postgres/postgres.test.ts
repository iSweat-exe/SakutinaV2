import { readdirSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresAuditLog } from "@/database/postgres/repositories/postgres-audit-log.ts";

let client: PGlite;
let db: Database;

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client) as unknown as Database;
  await migrate(db);
});

afterAll(async () => {
  await client.close();
});

test("les migrations sont idempotentes", async () => {
  expect(await migrate(db)).toEqual([]);
});

test("RLS est activé sur toutes les tables : une table sans RLS serait lisible par `anon` sur Supabase", async () => {
  const result = await client.query<{ relname: string; relrowsecurity: boolean }>(
    `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'`,
  );

  expect(result.rows.length).toBeGreaterThan(10);
  expect(result.rows.filter((row) => !row.relrowsecurity).map((row) => row.relname)).toEqual([]);
});

test("le journal d'audit conserve, trie et purge", async () => {
  const log = new PostgresAuditLog(db);
  const event = (day: number) => ({
    id: crypto.randomUUID(),
    action: "member.joined" as const,
    guildId: "g",
    occurredAt: new Date(Date.UTC(2026, 10, day)),
    actorId: null,
    targetId: "m",
    metadata: { inviteCode: "abc", n: day },
  });

  await log.append(event(1));
  await log.append(event(10));
  await log.append(event(20));

  const latest = await log.listForGuild("g", 2);
  expect(latest.map((entry) => entry.metadata.n)).toEqual([20, 10]);
  expect(latest[0]?.occurredAt).toBeInstanceOf(Date);

  expect(await log.purgeBefore(new Date(Date.UTC(2026, 10, 5)))).toBe(1);
  expect(await log.listForGuild("g", 10)).toHaveLength(2);
});

test("la table de migrations enregistre le fichier appliqué", async () => {
  const result = await db.execute(sql`SELECT name FROM schema_migrations`);
  const rows = (
    Array.isArray(result)
      ? result
      : (result as unknown as { rows: unknown[] }).rows
  ) as { name: string }[];

  // Les fichiers du dossier, ni plus ni moins : ajouter une migration ne demande aucune édition ici.
  const files = readdirSync(new URL("../../../src/database/postgres/migrations/", import.meta.url))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  expect(rows.map((row) => row.name).sort()).toEqual(files);
});

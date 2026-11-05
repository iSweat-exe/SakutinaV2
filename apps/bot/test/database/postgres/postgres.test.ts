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

test("RLS est activé sur les tables exposées par Supabase", async () => {
  const result = await client.query<{ relname: string; relrowsecurity: boolean }>(
    "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('activity_daily','audit_event','social_edge_daily','member_hour_daily','presence_status_daily','presence_game_daily','identity_event','phaethon_alert','activity_monthly','moderation_warning','panel_admin')",
  );

  expect(result.rows).toHaveLength(11);
  expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
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

  expect(rows.map((row) => row.name)).toEqual(["0001_init.sql", "0002_economy.sql", "0003_tracking.sql", "0004_daily_reward.sql", "0005_phaethon.sql", "0006_moderation.sql", "0007_panel_access.sql"]);
});

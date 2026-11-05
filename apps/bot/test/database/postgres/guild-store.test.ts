import { defaultSettings } from "@/domain/guilds/guild-types.ts";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresGuildStore } from "@/database/postgres/repositories/postgres-guild-store.ts";

let client: PGlite;
let store: PostgresGuildStore;

const guild = (guildId: string, name = guildId) => ({ guildId, name, icon: "i", banner: null, ownerId: "owner", memberCount: 5 });
const count = async (table: string) =>
  Number((await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0]?.n);

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client) as unknown as Database;
  await migrate(db);
  store = new PostgresGuildStore(db);
});

afterAll(async () => {
  await client.close();
});

test("une fiche de serveur se crée puis se met à jour", async () => {
  await store.upsertGuild(guild("a"));
  await store.upsertGuild(guild("a", "Renommé"));

  const rows = await client.query<{ name: string; icon: string }>("SELECT name, icon FROM bot_guild WHERE guild_id = 'a'");
  expect(rows.rows).toEqual([{ name: "Renommé", icon: "i" }]);
});

test("la liste des gestionnaires est remplacée en entier", async () => {
  await store.replaceManagers("a", ["m1", "m2"]);
  await store.replaceManagers("a", ["m2", "m3"]);

  const rows = await client.query<{ member_id: string }>("SELECT member_id FROM guild_manager WHERE guild_id = 'a' ORDER BY 1");
  expect(rows.rows.map((row) => row.member_id)).toEqual(["m2", "m3"]);

  await store.replaceManagers("a", []);
  expect(await count("guild_manager")).toBe(0);
});

test("retainGuilds retire les serveurs quittés et leurs gestionnaires, jamais leurs réglages", async () => {
  await store.upsertGuild(guild("b"));
  await store.replaceManagers("b", ["m"]);
  await store.insertSettingsIfMissing({ ...defaultSettings("b"), adminRoleIds: ["r"], moderatorRoleIds: [], alertChannelId: null });

  expect(await store.retainGuilds(["a"])).toBe(1);
  expect(await count("bot_guild")).toBe(1);
  expect(await count("guild_manager")).toBe(0);
  expect((await store.getSettings("b"))?.adminRoleIds).toEqual(["r"]);
});

test("les réglages ne s'écrivent qu'une fois", async () => {
  expect(await store.getSettings("c")).toBeNull();
  expect(
    await store.insertSettingsIfMissing({ ...defaultSettings("c"), adminRoleIds: [], moderatorRoleIds: ["m"], alertChannelId: "s" }),
  ).toBe(true);
  expect(
    await store.insertSettingsIfMissing({ ...defaultSettings("c"), adminRoleIds: ["x"], moderatorRoleIds: [], alertChannelId: null }),
  ).toBe(false);
  expect(await store.getSettings("c")).toEqual({ ...defaultSettings("c"), adminRoleIds: [], moderatorRoleIds: ["m"], alertChannelId: "s" });
});

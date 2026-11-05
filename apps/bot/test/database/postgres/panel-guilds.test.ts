import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Les refus (anonyme, non-administrateur) sont vérifiés pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu et l'isolation entre utilisateurs.
const OWNER = "11111111-1111-1111-1111-111111111111";
const MANAGER = "22222222-2222-2222-2222-222222222222";
const STRANGER = "33333333-3333-3333-3333-333333333333";
let client: PGlite;

type GuildRow = { id: string; name: string | null; icon: string | null; banner: string | null; member_count: number | null; role: string };

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES
      ('${OWNER}', 'discord', 'd-owner'), ('${MANAGER}', 'discord', 'd-manager'), ('${STRANGER}', 'discord', 'd-stranger');

    INSERT INTO bot_guild (guild_id, name, icon, banner, owner_id, member_count) VALUES
      ('a', 'Zèbre', 'icone-a', 'banniere-a', 'd-owner', 10),
      ('b', 'abeille', NULL, NULL, 'd-someone', 20),
      ('c', 'Caché', NULL, NULL, 'd-someone', 30);
    INSERT INTO guild_manager (guild_id, member_id) VALUES ('b', 'd-manager'), ('b', 'd-owner');
    -- Accès manuel à un serveur où le bot n'est pas : pas listé (le bot n'y est pas), mais sa fiche s'ouvre.
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('legacy', 'd-manager', 'admin');
  `);
});

afterAll(async () => {
  await client.close();
});

const myGuilds = async (user: string) => {
  await actAs(client, user);
  return (await client.query<{ result: GuildRow[] }>("SELECT panel_my_guilds() AS result")).rows[0]!.result;
};

test("panel_my_guilds : les serveurs du bot que l'appelant gère, triés par nom, avec son rôle", async () => {
  expect(await myGuilds(OWNER)).toEqual([
    { id: "b", name: "abeille", icon: null, banner: null, member_count: 20, role: "admin" },
    { id: "a", name: "Zèbre", icon: "icone-a", banner: "banniere-a", member_count: 10, role: "owner" },
  ]);
  expect((await myGuilds(MANAGER)).map((guild) => guild.id)).toEqual(["b"]);
});

test("panel_my_guilds : un inconnu reçoit une liste vide, jamais les serveurs des autres", async () => {
  expect(await myGuilds(STRANGER)).toEqual([]);
});

test("panel_guild : la fiche d'un serveur, ou un nom vide si le bot n'y est pas", async () => {
  await actAs(client, OWNER);
  const a = (await client.query<{ result: GuildRow }>("SELECT panel_guild('a') AS result")).rows[0]!.result;
  expect(a).toEqual({ id: "a", name: "Zèbre", icon: "icone-a", banner: "banniere-a", member_count: 10, role: "owner" });

  await actAs(client, MANAGER);
  const legacy = (await client.query<{ result: GuildRow }>("SELECT panel_guild('legacy') AS result")).rows[0]!.result;
  expect(legacy).toEqual({ id: "legacy", name: null, icon: null, banner: null, member_count: null, role: "admin" });
});

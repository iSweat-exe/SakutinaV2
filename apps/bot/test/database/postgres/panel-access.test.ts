import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth, isForbidden } from "../../support/fake-supabase.ts";

const GUILD = "g1";
const OWNER = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";
const IMPOSTOR = "33333333-3333-3333-3333-333333333333";
const OTHER_GUILD_ADMIN = "44444444-4444-4444-4444-444444444444";

let client: PGlite;

const as = (userId: string | null) => actAs(client, userId);
const forbidden = (call: string) => isForbidden(client, call);

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);

  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES
      ('${OWNER}', 'discord', 'discord-owner'),
      ('${STRANGER}', 'discord', 'discord-stranger'),
      ('${IMPOSTOR}', 'github', 'discord-owner'),
      ('${OTHER_GUILD_ADMIN}', 'discord', 'discord-elsewhere');

    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES
      ('${GUILD}', 'discord-owner', 'owner'),
      ('other', 'discord-elsewhere', 'admin');

    -- Messages : 10 cette heure-ci, 5 il y a deux heures, 7 il y a 30 heures (hors fenêtre).
    INSERT INTO activity_hourly (guild_id, day, hour, messages)
    SELECT '${GUILD}', (t AT TIME ZONE 'utc')::date, extract(hour FROM t AT TIME ZONE 'utc')::int, m
    FROM (VALUES (now(), 10), (now() - interval '2 hours', 5), (now() - interval '30 hours', 7)) AS v(t, m);

    INSERT INTO member_profile (guild_id, member_id, first_seen_at, last_active_at, left_at) VALUES
      ('${GUILD}', 'a', now(), now() - interval '1 hour', NULL),
      ('${GUILD}', 'b', now(), now() - interval '3 days', NULL),
      ('${GUILD}', 'c', now(), now() - interval '1 hour', now()),
      ('other', 'z', now(), now(), NULL);

    INSERT INTO economy_account (guild_id, member_id, wallet, bank) VALUES
      ('${GUILD}', 'a', 100, 400), ('${GUILD}', 'b', 50, 0), ('other', 'z', 999999, 0);

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata) VALUES
      (gen_random_uuid(), 'moderation.ban', '${GUILD}', now() - interval '3 minutes', 'mod', 'x', '{"reason":"spam","result":"ok"}'),
      (gen_random_uuid(), 'profile.viewed', '${GUILD}', now() - interval '1 minute', 'mod', 'x', '{}'),
      (gen_random_uuid(), 'moderation.warn', '${GUILD}', now() - interval '10 minutes', 'mod', 'y', '{}'),
      (gen_random_uuid(), 'moderation.kick', 'other', now(), 'mod', 'q', '{}');
  `);
});

afterAll(async () => {
  await client.close();
});

test("un administrateur du serveur obtient son rôle", async () => {
  await as(OWNER);
  const result = await client.query<{ panel_role: string }>("SELECT panel_role('g1')");
  expect(result.rows[0]?.panel_role).toBe("owner");
});

test("personne d'autre n'a de rôle : inconnu, anonyme, autre serveur, autre fournisseur", async () => {
  const role = async (user: string | null, guild: string) => {
    await as(user);
    return (await client.query<{ panel_role: string | null }>("SELECT panel_role($1)", [guild])).rows[0]?.panel_role;
  };

  expect(await role(STRANGER, GUILD)).toBeNull();
  expect(await role(null, GUILD)).toBeNull();
  expect(await role(OTHER_GUILD_ADMIN, GUILD)).toBeNull();
  // Même identifiant Discord, mais via un autre fournisseur : refusé.
  expect(await role(IMPOSTOR, GUILD)).toBeNull();
});

test("les fonctions de données refusent quiconque n'est pas administrateur", async () => {
  for (const user of [STRANGER, null, OTHER_GUILD_ADMIN, IMPOSTOR]) {
    await as(user);
    expect(await forbidden("SELECT panel_overview('g1')")).toBe(true);
    expect(await forbidden("SELECT panel_recent_audit('g1')")).toBe(true);
  }
});

test("la vue d'ensemble agrège uniquement le serveur demandé", async () => {
  await as(OWNER);
  const { rows } = await client.query<{ panel_overview: Record<string, unknown> }>("SELECT panel_overview('g1')");
  const overview = rows[0]?.panel_overview as {
    messages_24h: number;
    active_members_24h: number;
    members: number;
    coins_total: number;
    hourly: Array<{ hour: number; messages: number; at: string }>;
  };

  expect(overview.messages_24h).toBe(15);
  expect(overview.active_members_24h).toBe(1);
  expect(overview.members).toBe(2);
  expect(overview.coins_total).toBe(550);
  expect(overview.hourly).toHaveLength(24);
  expect(overview.hourly.at(-1)?.messages).toBe(10);
  expect(overview.hourly.map((slot) => slot.at)).toEqual([...overview.hourly.map((slot) => slot.at)].sort());
});

test("le journal ne renvoie que la modération du serveur, du plus récent au plus ancien", async () => {
  await as(OWNER);
  const { rows } = await client.query<{ panel_recent_audit: Array<{ action: string }> }>("SELECT panel_recent_audit('g1', 10)");
  expect(rows[0]?.panel_recent_audit.map((event) => event.action)).toEqual(["moderation.ban", "moderation.warn"]);

  const limited = await client.query<{ panel_recent_audit: unknown[] }>("SELECT panel_recent_audit('g1', 1)");
  expect(limited.rows[0]?.panel_recent_audit).toHaveLength(1);
});

test("la table des administrateurs est protégée par RLS", async () => {
  const result = await client.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname = 'panel_admin'");
  expect(result.rows[0]?.relrowsecurity).toBe(true);
});

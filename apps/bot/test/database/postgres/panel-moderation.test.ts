import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu, l'isolation entre serveurs et les écritures.
const ADMIN = "11111111-1111-1111-1111-111111111111";
let client: PGlite;

type Sanction = {
  id: string;
  kind: "mute" | "ban" | "warn";
  member_id: string;
  name: string | null;
  reason: string;
  by: string;
  ends_at: string | null;
  revoke_status: string | null;
};
type Automod = { spam: boolean; links: boolean; words: boolean; mentions: boolean; banned_words: string[]; mute_minutes: number };
type Moderation = {
  actions_24h: number;
  actions_by_bot_24h: number;
  warnings_7d: number;
  warned_members_2plus: number;
  sanctions: Sanction[];
  automod: Automod;
};

const q = async <T>(sql: string) => (await client.query<{ result: T }>(sql)).rows[0]!.result;
const moderation = async () => {
  await actAs(client, ADMIN);
  return q<Moderation>("SELECT panel_moderation('g') AS result");
};

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin'), ('other', 'd-admin', 'admin');

    INSERT INTO member_profile (guild_id, member_id, first_seen_at, display_name) VALUES
      ('g', 'victim-1', now(), 'Aiko'), ('g', 'mod-1', now(), 'Mika'), ('other', 'victim-x', now(), 'Intrus');

    -- Sanctions actives, échues, levées, et d'un autre serveur.
    INSERT INTO moderation_sanction (guild_id, member_id, kind, moderator_id, reason, created_at, ends_at, revoked_at) VALUES
      ('g', 'victim-1', 'mute', 'mod-1', 'spam', now() - interval '10 minutes', now() + interval '50 minutes', NULL),
      ('g', 'victim-2', 'mute', 'sakutina', 'mentions', now() - interval '5 minutes', now() + interval '55 minutes', NULL),
      ('g', 'victim-3', 'mute', 'mod-1', 'échu', now() - interval '3 hours', now() - interval '2 hours', NULL),
      ('g', 'victim-4', 'ban', NULL, 'raid', now() - interval '26 hours', NULL, NULL),
      ('g', 'victim-5', 'ban', 'mod-1', 'levé', now() - interval '2 days', NULL, now() - interval '1 day'),
      ('other', 'victim-x', 'ban', 'mod-1', 'ailleurs', now() - interval '1 day', NULL, NULL);

    INSERT INTO moderation_warning (guild_id, member_id, moderator_id, reason, created_at) VALUES
      ('g', 'victim-1', 'mod-1', 'a', now() - interval '1 day'),
      ('g', 'victim-1', 'mod-1', 'b', now() - interval '2 days'),
      ('g', 'victim-2', 'mod-1', 'c', now() - interval '3 days'),
      ('g', 'victim-3', 'mod-1', 'trop vieux', now() - interval '30 days'),
      ('g', 'victim-6', 'mod-1', 'expiré', now() - interval '400 days'),
      ('other', 'victim-x', 'mod-1', 'ailleurs', now());

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata) VALUES
      (gen_random_uuid(), 'moderation.ban', 'g', now() - interval '1 hour', 'mod-1', 'x', '{"result":"ok"}'),
      (gen_random_uuid(), 'moderation.warn', 'g', now() - interval '2 hours', 'mod-1', 'x', '{}'),
      (gen_random_uuid(), 'moderation.kick', 'g', now() - interval '3 hours', 'mod-1', 'x', '{"result":"failed"}'),
      (gen_random_uuid(), 'moderation.timeout', 'g', now() - interval '4 hours', 'mod-1', 'x', '{"result":"refused:role"}'),
      (gen_random_uuid(), 'automod.delete', 'g', now() - interval '1 hour', NULL, 'x', '{"rule":"words","result":"ok"}'),
      (gen_random_uuid(), 'automod.timeout', 'g', now() - interval '1 hour', NULL, 'x', '{"rule":"mentions","result":"ok"}'),
      (gen_random_uuid(), 'moderation.ban', 'g', now() - interval '30 hours', 'mod-1', 'x', '{"result":"ok"}'),
      (gen_random_uuid(), 'profile.viewed', 'g', now() - interval '1 hour', 'mod-1', 'x', '{}'),
      (gen_random_uuid(), 'moderation.ban', 'other', now(), 'mod-1', 'x', '{"result":"ok"}');
  `);
});

afterAll(async () => {
  await client.close();
});

test("actions des 24 h : seulement les réussies de ce serveur ; « Sakutina » = auto-modération", async () => {
  const result = await moderation();

  // ban ok, warn (sans résultat), automod.delete, automod.timeout : 4. Échecs, refus, ancien et autre serveur exclus.
  expect(result.actions_24h).toBe(4);
  expect(result.actions_by_bot_24h).toBe(2);
});

test("avertissements : 7 jours, et les membres qui en ont 2 ou plus", async () => {
  const result = await moderation();

  expect(result.warnings_7d).toBe(3);
  expect(result.warned_members_2plus).toBe(1);
});

test("sanctions actives : mutes en cours, bannissements non levés, avertissements non expirés, du plus récent au plus ancien", async () => {
  const { sanctions } = await moderation();

  expect(sanctions.map((s) => `${s.kind}:${s.member_id}`)).toEqual([
    "mute:victim-2",
    "mute:victim-1",
    "warn:victim-1",
    "ban:victim-4",
    "warn:victim-1",
    "warn:victim-2",
    "warn:victim-3",
  ]);
});

test("chaque sanction porte le nom du membre et de qui l'a posée (Sakutina, Discord, modérateur)", async () => {
  const { sanctions } = await moderation();
  const by = (member: string, kind = "mute") => sanctions.find((s) => s.member_id === member && s.kind === kind);

  expect(by("victim-1")).toMatchObject({ name: "Aiko", by: "Mika", reason: "spam", revoke_status: null });
  expect(by("victim-2")).toMatchObject({ name: null, by: "Sakutina" });
  expect(by("victim-4", "ban")).toMatchObject({ by: "Discord", ends_at: null });
  expect(by("victim-3", "warn")?.by).toBe("Mika");
});

test("réglages d'auto-modération : tout éteint par défaut, puis ceux du serveur ; NULL ne change rien", async () => {
  expect((await moderation()).automod).toEqual({ spam: false, links: false, words: false, mentions: false, banned_words: [], mute_minutes: 60 });

  await actAs(client, ADMIN);
  const set = (args: string) => q<Automod>(`SELECT panel_set_automod('g', ${args}) AS result`);

  expect(await set("true, NULL, true, NULL, NULL, 15")).toEqual({
    spam: true,
    links: false,
    words: true,
    mentions: false,
    banned_words: [],
    mute_minutes: 15,
  });
  expect((await set("NULL, NULL, NULL, true, NULL, NULL")).mentions).toBe(true);
  expect(await set("NULL, NULL, NULL, NULL, NULL, NULL")).toMatchObject({ spam: true, words: true, mentions: true, mute_minutes: 15 });
});

test("mots interdits : minuscules, sans doublon ni vide, triés ; la liste remplace la précédente", async () => {
  await actAs(client, ADMIN);
  const result = await q<Automod>("SELECT panel_set_automod('g', NULL, NULL, NULL, NULL, ARRAY['Arnaque', ' arnaque ', 'SPAM', '', '   ']) AS result");

  expect(result.banned_words).toEqual(["arnaque", "spam"]);
  expect((await q<Automod>("SELECT panel_set_automod('g', NULL, NULL, NULL, NULL, ARRAY['seul']) AS result")).banned_words).toEqual(["seul"]);
});

test("réglages hors limites refusés sans rien changer ; modification journalisée avec son auteur", async () => {
  await actAs(client, ADMIN);
  const tooMany = Array.from({ length: 101 }, (_, i) => `mot${i}`).join("','");

  for (const args of [
    "NULL, NULL, NULL, NULL, NULL, 0",
    "NULL, NULL, NULL, NULL, NULL, 40321",
    `NULL, NULL, NULL, NULL, ARRAY['${tooMany}'], NULL`,
    `NULL, NULL, NULL, NULL, ARRAY['${"x".repeat(33)}'], NULL`,
  ]) {
    await expect(client.query(`SELECT panel_set_automod('g', ${args})`)).rejects.toThrow(/invalid/);
  }

  expect((await moderation()).automod).toMatchObject({ banned_words: ["seul"], mute_minutes: 15 });

  const audit = await client.query<{ actor_id: string }>("SELECT actor_id FROM audit_event WHERE action = 'settings.automod' AND guild_id = 'g' LIMIT 1");
  expect(audit.rows[0]?.actor_id).toBe("d-admin");
});

test("lever un avertissement : supprimé tout de suite, journalisé ; celui d'un autre serveur est intouchable", async () => {
  await actAs(client, ADMIN);
  const { sanctions } = await moderation();
  const warn = sanctions.find((s) => s.kind === "warn" && s.member_id === "victim-2")!;
  const id = Number(warn.id.split(":")[1]);

  expect(await q<{ status: string }>(`SELECT panel_revoke_sanction('g', 'warn', ${id}) AS result`)).toEqual({ status: "done" });
  expect((await moderation()).sanctions.some((s) => s.id === warn.id)).toBe(false);
  await expect(client.query(`SELECT panel_revoke_sanction('g', 'warn', ${id})`)).rejects.toThrow(/invalid/);

  const foreign = await client.query<{ id: number }>("SELECT id FROM moderation_warning WHERE guild_id = 'other'");
  await expect(client.query(`SELECT panel_revoke_sanction('g', 'warn', ${foreign.rows[0]!.id})`)).rejects.toThrow(/invalid/);
  expect((await client.query("SELECT 1 FROM moderation_warning WHERE guild_id = 'other'")).rows).toHaveLength(1);

  const audit = await client.query<{ actor_id: string; metadata: Record<string, unknown> }>(
    "SELECT actor_id, metadata FROM audit_event WHERE action = 'moderation.unwarn' AND guild_id = 'g'",
  );
  expect(audit.rows[0]).toEqual({ actor_id: "d-admin", metadata: { warning_id: id, result: "ok", source: "panel" } });
});

test("lever un mute ou un bannissement : une demande pour le bot, une seule, visible « pending » dans la liste", async () => {
  await actAs(client, ADMIN);
  const ban = (await moderation()).sanctions.find((s) => s.kind === "ban")!;
  const id = Number(ban.id.split(":")[1]);

  expect(await q<{ status: string }>(`SELECT panel_revoke_sanction('g', 'ban', ${id}) AS result`)).toEqual({ status: "pending" });
  expect(await q<{ status: string }>(`SELECT panel_revoke_sanction('g', 'ban', ${id}) AS result`)).toEqual({ status: "pending" });

  const commands = await client.query<{ guild_id: string; sanction_id: number; requested_by: string; status: string }>(
    "SELECT guild_id, sanction_id, requested_by, status FROM moderation_command",
  );
  expect(commands.rows).toEqual([{ guild_id: "g", sanction_id: id, requested_by: "d-admin", status: "pending" }]);
  expect((await moderation()).sanctions.find((s) => s.id === ban.id)?.revoke_status).toBe("pending");

  // Le bot échoue : la sanction reste active et le panneau voit « failed » ; une nouvelle demande est possible.
  await client.query("UPDATE moderation_command SET status = 'failed', error = 'Missing Permissions'");
  expect((await moderation()).sanctions.find((s) => s.id === ban.id)?.revoke_status).toBe("failed");
  await q(`SELECT panel_revoke_sanction('g', 'ban', ${id}) AS result`);
  expect((await client.query("SELECT 1 FROM moderation_command")).rows).toHaveLength(2);
});

test("on ne lève que ses propres sanctions actives, d'un type valide", async () => {
  await actAs(client, ADMIN);
  const foreign = await client.query<{ id: number }>("SELECT id FROM moderation_sanction WHERE guild_id = 'other'");
  const revoked = await client.query<{ id: number }>("SELECT id FROM moderation_sanction WHERE member_id = 'victim-5'");
  const expired = await client.query<{ id: number }>("SELECT id FROM moderation_sanction WHERE member_id = 'victim-3'");

  for (const call of [
    `'ban', ${foreign.rows[0]!.id}`,
    `'ban', ${revoked.rows[0]!.id}`,
    `'mute', ${expired.rows[0]!.id}`,
    "'kick', 1",
    "'ban', 99999",
    "NULL, NULL",
  ]) {
    await expect(client.query(`SELECT panel_revoke_sanction('g', ${call})`)).rejects.toThrow(/invalid/);
  }
});

test("un non-administrateur ne lit rien, ne règle rien, ne lève rien", async () => {
  await actAs(client, null);

  for (const call of ["panel_moderation('g')", "panel_set_automod('g', true)", "panel_revoke_sanction('g', 'warn', 1)"]) {
    await expect(client.query(`SELECT ${call}`)).rejects.toThrow(/forbidden/);
  }
});

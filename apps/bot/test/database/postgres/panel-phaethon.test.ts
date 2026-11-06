import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresPhaethonStore } from "@/database/postgres/repositories/postgres-phaethon-store.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu (score, dossier) et les deux actions.
const ADMIN = "11111111-1111-1111-1111-111111111111";
const DAY = 86_400_000;
const NOW = Date.now();

/** Identifiant Discord d'un compte créé il y a `days` jours (l'horodatage est dans l'identifiant). */
const snowflake = (days: number, n: number) => String(((BigInt(Math.floor(NOW - days * DAY)) - 1420070400000n) << 22n) + BigInt(n));

const RAID = [snowflake(1, 1), snowflake(1, 2), snowflake(2, 3), snowflake(1, 4)];
const BOT = snowflake(400, 5);
const REGULAR = snowflake(900, 6);
const OWNER_ID = snowflake(1500, 7);
const ELSEWHERE = snowflake(1, 8);

type Entry = Readonly<{
  member_id: string;
  name: string | null;
  points: number[];
  delta: number;
  confidence: number;
  flags: string[];
  review: string | null;
  ban_status: string | null;
  links: { member_id: string; relations: string[]; score: number | null }[];
  heat: { day: string; hours: number[] }[];
  rate: number[];
  transfers: { member_id: string; direction: string; coins: number }[];
  casino: { won: number; played: number };
  events: { kind: string }[];
}>;
type Phaethon = Readonly<{ members_tracked: number; dismissed_7d: number; server_median: number; entries: Entry[] }>;

let client: PGlite;

const phaethon = async (guild = "g") => (await client.query<{ r: Phaethon }>(`SELECT panel_phaethon('${guild}') AS r`)).rows[0]!.r;
const entry = (data: Phaethon, id: string) => data.entries.find((e) => e.member_id === id);
const score = (e: Entry | undefined) => (e ? e.points.reduce((a, b) => a + b, 0) : 0);
const error = async (query: string) => {
  try {
    await client.query(query);
    return null;
  } catch (failure) {
    return (failure as { code?: string }).code ?? "unknown";
  }
};

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);

  const joined = new Date(NOW - 3 * 3_600_000).toISOString();
  const profiles = [
    ...RAID.map((id, i) => `('g', '${id}', '${joined}', '${joined}'::timestamptz + interval '${i * 20} seconds', 'raider${i}', 'abc')`),
    `('g', '${BOT}', now() - interval '300 days', now() - interval '300 days', 'nova_trade', NULL)`,
    `('g', '${REGULAR}', now() - interval '600 days', now() - interval '600 days', 'Hana', NULL)`,
    `('g', '${OWNER_ID}', now() - interval '900 days', now() - interval '900 days', 'Mika', NULL)`,
    `('autre', '${ELSEWHERE}', '${joined}', '${joined}', 'raider9', 'abc')`,
  ];

  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin');
    INSERT INTO bot_guild (guild_id, name, owner_id, member_count) VALUES ('g', 'Uwu', '${OWNER_ID}', 7);
    INSERT INTO member_profile (guild_id, member_id, first_seen_at, joined_at, display_name, avatar) VALUES ${profiles.join(", ")};

    -- Un compte qui écrit à toute heure, toute la journée d'hier.
    INSERT INTO member_hour_daily (guild_id, member_id, day, hour, messages)
    SELECT 'g', '${BOT}', (now() AT TIME ZONE 'UTC')::date - 1, h, 28 FROM generate_series(0, 23) h;
    -- Un membre ordinaire, le soir.
    INSERT INTO member_hour_daily (guild_id, member_id, day, hour, messages)
    SELECT 'g', '${REGULAR}', (now() AT TIME ZONE 'UTC')::date - 1, h, 5 FROM generate_series(18, 22) h;

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata) VALUES
      (gen_random_uuid(), 'automod.delete', 'g', now() - interval '2 hours', NULL, '${BOT}', '{"rule": "links", "result": "ok"}'),
      (gen_random_uuid(), 'automod.delete', 'g', now() - interval '1 hours', NULL, '${BOT}', '{"rule": "links", "result": "ok"}');

    INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at) VALUES
      (gen_random_uuid(), 'g', '${BOT}', 'spend', 12000, 0, 0, 'pay:to:${RAID[0]}', 'k1', now() - interval '1 hour'),
      (gen_random_uuid(), 'g', '${RAID[0]}', 'earn', 12000, 12000, 0, 'pay:from:${BOT}', 'k2', now() - interval '1 hour');
  `);
  await actAs(client, ADMIN);
});

afterAll(async () => {
  await client.close();
});

test("les comptes d'un raid ressortent : compte neuf, arrivés ensemble, même avatar", async () => {
  const data = await phaethon();
  const raider = entry(data, RAID[0]!);

  expect(data.members_tracked).toBe(7);
  expect(raider?.name).toBe("raider0");
  expect(raider?.flags).toEqual(expect.arrayContaining(["new-account", "join-cluster", "same-avatar"]));
  // Intégrité : compte d'un jour (10) créé moins d'un jour avant d'arriver (4) ; coordination : 3 comptes liés (20).
  expect(raider?.flags).toContain("fresh-at-join");
  expect(raider?.points.slice(0, 2)).toEqual([14, 20]);
  expect(raider?.links.map((l) => l.member_id).sort()).toEqual(RAID.slice(1).sort());
  // « raider0 » et « raider1 » ne diffèrent que par un chiffre : même nom.
  expect(raider?.links[0]?.relations).toEqual(["avatar", "join", "name"]);
  expect(raider?.links[0]?.score).toBeGreaterThanOrEqual(25);
  // Arrivés il y a 3 heures : la veille, ils n'existaient pas, tout le score est nouveau.
  expect(raider?.delta).toBe(score(raider));
  expect(raider?.transfers).toEqual([{ member_id: BOT, name: "nova_trade", direction: "in", coins: 12000 }] as never);
  expect(raider?.events.map((e) => e.kind)).toEqual(["join"]);
});

test("l'automatisation, l'auto-modération et l'économie expliquent le score d'un robot", async () => {
  const bot = entry(await phaethon(), BOT);

  expect(bot?.flags).toEqual(expect.arrayContaining(["sleepless", "automod", "big-transfers"]));
  expect(bot?.points).toEqual([0, 0, 12, 10, 4, 0]);
  expect(bot?.heat).toHaveLength(7);
  expect(bot?.heat[5]?.hours).toEqual(Array(24).fill(28));
  expect(bot?.rate).toHaveLength(72);
  expect(bot?.events.map((e) => e.kind)).toEqual(["join", "automod.delete", "automod.delete"]);
  expect(bot?.casino).toEqual({ won: 0, played: 0 });
});

test("un membre ordinaire et un autre serveur ne sont jamais dans la liste", async () => {
  const data = await phaethon();

  expect(entry(data, REGULAR)).toBeUndefined();
  expect(entry(data, ELSEWHERE)).toBeUndefined();
  expect(data.entries.map((e) => e.member_id)).toHaveLength(5);
  expect(data.server_median).toBe(28);
});

test("le résumé du tableau de bord : les plus hauts scores d'abord, et le nombre de comptes signalés", async () => {
  const { rows } = await client.query<{ r: { count: number; top: { member_id: string; score: number; flags: string[] }[] } }>(
    "SELECT panel_phaethon_top('g') AS r",
  );
  const listed = (await phaethon()).entries;

  expect(rows[0]?.r.count).toBe(listed.length);
  expect(rows[0]?.r.top.map((t) => t.member_id)).toEqual(listed.slice(0, 3).map((e) => e.member_id));
  expect(rows[0]?.r.top[0]?.score).toBe(score(listed[0]));
});

test("écarter retire un compte de la liste, surveiller l'y garde ; chaque décision est journalisée", async () => {
  await client.query(`SELECT panel_set_phaethon_review('g', '${RAID[3]}', 'dismissed')`);
  await client.query(`SELECT panel_set_phaethon_review('g', '${REGULAR}', 'watch')`);
  const data = await phaethon();

  expect(entry(data, RAID[3]!)).toBeUndefined();
  expect(entry(data, REGULAR)?.review).toBe("watch");
  expect(data.dismissed_7d).toBe(1);

  await client.query(`SELECT panel_set_phaethon_review('g', '${REGULAR}', 'clear')`);
  expect(entry(await phaethon(), REGULAR)).toBeUndefined();

  const audit = await client.query<{ action: string; actor_id: string; target_id: string }>(
    "SELECT action, actor_id, target_id FROM audit_event WHERE action LIKE 'phaethon.%' ORDER BY occurred_at",
  );
  expect(audit.rows.filter((r) => r.action === "phaethon.review")).toHaveLength(3);
  // Consulter est journalisé, une fois par heure.
  expect(audit.rows.filter((r) => r.action === "phaethon.viewed")).toEqual([{ action: "phaethon.viewed", actor_id: "d-admin", target_id: null }] as never);

  expect(await error(`SELECT panel_set_phaethon_review('g', '${ELSEWHERE}', 'watch')`)).toBe("22023");
  expect(await error(`SELECT panel_set_phaethon_review('g', '${BOT}', 'ban')`)).toBe("22023");
});

test("bannir : une demande pour le bot, une seule à la fois ; jamais le propriétaire ni un autre serveur", async () => {
  const request = await client.query<{ r: { status: string } }>(`SELECT panel_request_ban('g', '${BOT}', '  Robot de spam  ') AS r`);
  await client.query(`SELECT panel_request_ban('g', '${BOT}', 'encore')`);

  expect(request.rows[0]?.r).toEqual({ status: "pending" });
  const commands = await client.query("SELECT action, member_id, reason, requested_by, status, sanction_id FROM moderation_command");
  expect(commands.rows).toEqual([
    { action: "ban", member_id: BOT, reason: "Robot de spam", requested_by: "d-admin", status: "pending", sanction_id: null },
  ]);
  expect(entry(await phaethon(), BOT)?.ban_status).toBe("pending");

  expect(await error(`SELECT panel_request_ban('g', '${OWNER_ID}', 'non')`)).toBe("22023");
  expect(await error(`SELECT panel_request_ban('g', '${ELSEWHERE}', 'non')`)).toBe("22023");
  expect(await error(`SELECT panel_request_ban('g', '${RAID[1]}', '   ')`)).toBe("22023");
  expect(await error(`SELECT panel_request_ban('g', '${RAID[1]}')`)).toBe("22023");
});

test("les calculs internes ne sont pas appelables par le panneau", async () => {
  const grants = await client.query<{ name: string; public: boolean }>(
    `SELECT proname AS name, has_function_privilege('public', oid, 'EXECUTE') AS public
     FROM pg_proc WHERE proname IN ('phaethon_risk', 'phaethon_links')`,
  );
  expect(grants.rows.map((r) => r.public)).toEqual([false, false]);
});

test("/me forget efface les décisions du panneau sur le membre ; la purge retire celles de plus de 30 jours", async () => {
  const store = new PostgresPhaethonStore(drizzle(client) as unknown as Database);
  await client.query(`SELECT panel_set_phaethon_review('g', '${RAID[2]}', 'watch')`);
  await client.query(`SELECT panel_set_phaethon_review('g', '${RAID[1]}', 'watch')`);
  await client.query(`UPDATE phaethon_review SET reviewed_at = now() - interval '40 days' WHERE member_id = '${RAID[1]}'`);

  await store.deleteMember("g", RAID[2]!);
  await store.purgeBefore("2000-01-01", new Date(NOW - 30 * DAY));

  const left = await client.query<{ member_id: string }>("SELECT member_id FROM phaethon_review ORDER BY member_id");
  expect(left.rows.map((r) => r.member_id)).toEqual([RAID[3]!]);
});

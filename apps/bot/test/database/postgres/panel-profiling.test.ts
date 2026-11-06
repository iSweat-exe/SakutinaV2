import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresMemberStore } from "@/database/postgres/repositories/postgres-member-store.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu, la recherche et l'isolation entre serveurs.
const ADMIN = "11111111-1111-1111-1111-111111111111";

type Member = Readonly<{
  member_id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  joined_at: string;
  last_active_at: string | null;
  roles: string[];
  messages_30d: number;
  voice_minutes_30d: number;
  balance: number;
  warnings: number;
  days: { day: string; messages: number; voice_minutes: number }[];
}>;
type Profiling = Readonly<{ generated_at: string; query: string | null; members_present: number; members: Member[] }>;

let client: PGlite;

const profiling = async (guild = "g", query: string | null = null) =>
  (await client.query<{ r: Profiling }>("SELECT panel_profiling($1, $2) AS r", [guild, query])).rows[0]!.r;

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client) as unknown as Database;
  await migrate(db);
  await installFakeSupabaseAuth(client);

  // Le bot écrit le nom d'utilisateur et les rôles avec le nom affiché.
  const members = new PostgresMemberStore(db);
  const joined = new Date("2025-03-01T10:00:00Z");
  await members.seed(
    "g",
    [
      { memberId: "101", joinedAt: joined, identity: { displayName: "Aiko", avatar: "a".repeat(32), username: "aiko", roleNames: ["Moderator", "Regular"] } },
      { memberId: "102", joinedAt: joined, identity: { displayName: "Ren", avatar: null, username: "ren.q", roleNames: [] } },
      { memberId: "103", joinedAt: null, identity: { displayName: "Sora", avatar: null, username: "sora", roleNames: ["Booster"] } },
    ],
    new Date(),
  );
  await members.seed("autre", [{ memberId: "101", joinedAt: joined, identity: { displayName: "Aiko ailleurs", avatar: null, username: "aiko", roleNames: ["Admin"] } }], new Date());
  await members.markLeft("g", "103", new Date());

  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin'), ('autre', 'd-admin', 'admin');

    INSERT INTO activity_daily (guild_id, member_id, day, messages, voice_seconds) VALUES
      ('g', '101', current_date, 12, 3600),
      ('g', '101', current_date - 2, 30, 0),
      ('g', '101', current_date - 40, 999, 0),
      ('g', '102', current_date - 1, 5, 120),
      ('autre', '101', current_date, 500, 0);

    INSERT INTO economy_account (guild_id, member_id, wallet, bank) VALUES ('g', '101', 1200, 800), ('autre', '101', 99, 0);
    INSERT INTO moderation_warning (guild_id, member_id, moderator_id, reason, created_at) VALUES
      ('g', '102', '101', 'spam', now()), ('g', '102', '101', 'spam encore', now()), ('autre', '101', '102', 'ailleurs', now());
  `);

  await actAs(client, ADMIN);
});

afterAll(async () => {
  await client.close();
});

test("panel_profiling liste les membres présents, du plus actif au moins actif", async () => {
  const data = await profiling();

  expect(data.members_present).toBe(2);
  expect(data.query).toBeNull();
  expect(data.members.map((m) => m.member_id)).toEqual(["101", "102"]);
});

test("panel_profiling donne la fiche complète d'un membre, limitée à son serveur", async () => {
  const aiko = (await profiling()).members[0]!;

  expect(aiko).toMatchObject({
    name: "Aiko",
    username: "aiko",
    avatar: "a".repeat(32),
    roles: ["Moderator", "Regular"],
    // 30 jours seulement : l'activité d'il y a 40 jours et celle de l'autre serveur ne comptent pas.
    messages_30d: 42,
    voice_minutes_30d: 60,
    balance: 2000,
    warnings: 0,
  });
  expect(Date.parse(aiko.joined_at)).toBe(Date.parse("2025-03-01T10:00:00Z"));
  expect(aiko.days).toHaveLength(7);
  expect(aiko.days.map((d) => d.messages)).toEqual([0, 0, 0, 0, 30, 0, 12]);
  expect(aiko.days[6]!.voice_minutes).toBe(60);

  const ren = (await profiling()).members[1]!;
  expect(ren).toMatchObject({ roles: [], balance: 0, warnings: 2, messages_30d: 5, voice_minutes_30d: 2 });
});

test("panel_profiling cherche par nom affiché, nom d'utilisateur ou identifiant", async () => {
  expect((await profiling("g", "REN")).members.map((m) => m.member_id)).toEqual(["102"]);
  expect((await profiling("g", "ren.q")).members.map((m) => m.member_id)).toEqual(["102"]);
  expect((await profiling("g", "101")).members.map((m) => m.member_id)).toEqual(["101"]);
  // Un membre parti n'apparaît plus.
  expect((await profiling("g", "sora")).members).toEqual([]);
  expect((await profiling("g", "  aik ")).query).toBe("aik");
});

test("panel_profiling n'affiche que le serveur demandé", async () => {
  const data = await profiling("autre");

  expect(data.members).toHaveLength(1);
  expect(data.members[0]).toMatchObject({ name: "Aiko ailleurs", roles: ["Admin"], messages_30d: 500, balance: 99, warnings: 1 });
});

test("panel_profiling refuse une recherche trop longue", async () => {
  await expect(profiling("g", "x".repeat(101))).rejects.toMatchObject({ code: "22023" });
});

test("panel_profiling journalise la consultation une fois par heure", async () => {
  await profiling();
  await profiling();
  const { rows } = await client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM audit_event WHERE guild_id = 'g' AND action = 'profiling.viewed' AND actor_id = 'd-admin'",
  );

  expect(rows[0]!.n).toBe(1);
});

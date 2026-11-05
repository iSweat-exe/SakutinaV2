import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresActivityStore } from "@/database/postgres/repositories/postgres-activity-store.ts";
import { PostgresMemberStore } from "@/database/postgres/repositories/postgres-member-store.ts";
import type { ActivityStore } from "@/domain/activity/activity-store.ts";
import type { ActivitySnapshot, ChannelSnapshot } from "@/domain/activity/activity-types.ts";
import { countersWith } from "@/domain/activity/counters.ts";
import type { MemberStore } from "@/domain/members/member-store.ts";

const pglite = new PGlite();
const database = drizzle(pglite) as unknown as Database;
await migrate(database);
afterAll(async () => {
  await pglite.close();
});

const activityStores: [string, () => ActivityStore][] = [
  ["mémoire", () => new MemoryActivityStore()],
  ["PostgreSQL (PGlite)", () => new PostgresActivityStore(database)],
];
const memberStores: [string, () => MemberStore][] = [
  ["mémoire", () => new MemoryMemberStore()],
  ["PostgreSQL (PGlite)", () => new PostgresMemberStore(database)],
];

const daily = (
  guildId: string,
  memberId: string,
  day: string,
  counters: Parameters<typeof countersWith>[0],
): ActivitySnapshot => ({ guildId, memberId, day, ...countersWith(counters) });
const channel = (
  guildId: string,
  memberId: string,
  channelId: string,
  day: string,
  messages: number,
  voiceSeconds = 0,
): ChannelSnapshot => ({ guildId, memberId, channelId, day, messages, voiceSeconds });

for (const [label, create] of activityStores) {
  describe(`stockage d'activité — ${label}`, () => {
    // Chaque test utilise son propre serveur : les stores PostgreSQL partagent une base.
    const guild = () => `g-${crypto.randomUUID()}`;

    test("add additionne tous les compteurs, y compris les doublons d'un lot", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [
          daily(g, "m", "2026-11-01", { messages: 2, characters: 40, reactionsGiven: 1 }),
          daily(g, "m", "2026-11-01", { messages: 3, voiceSeconds: 5, leaves: 1 }),
        ],
        channels: [channel(g, "m", "c", "2026-11-01", 1), channel(g, "m", "c", "2026-11-01", 2, 7)],
        hourly: [
          { guildId: g, day: "2026-11-01", hour: 9, messages: 2, voiceSeconds: 0 },
          { guildId: g, day: "2026-11-01", hour: 9, messages: 1, voiceSeconds: 0 },
        ],
      });
      await store.add({
        daily: [daily(g, "m", "2026-11-01", { messages: 1, attachments: 4 })],
        channels: [],
        hourly: [],
      });

      const rows = await store.listForMember(g, "m");

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        messages: 6,
        characters: 40,
        reactionsGiven: 1,
        voiceSeconds: 5,
        leaves: 1,
        attachments: 4,
      });
      expect((await store.hourlyMessages(g, "2026-11-01"))[9]).toBe(3);
      expect(await store.topChannels(g, "messages", "2026-11-01", 5)).toEqual([
        { channelId: "c", value: 3 },
      ]);
      expect(await store.topChannels(g, "voiceSeconds", "2026-11-01", 5)).toEqual([
        { channelId: "c", value: 7 },
      ]);
    });

    test("leaderboard trie, filtre par période et exclut les valeurs nulles", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [
          daily(g, "a", "2026-11-01", { messages: 5 }),
          daily(g, "a", "2026-11-05", { messages: 1 }),
          daily(g, "b", "2026-11-05", { messages: 9 }),
          daily(g, "c", "2026-11-05", { voiceSeconds: 100 }),
          daily(g, "d", "2026-11-05", { messages: 6 }),
        ],
        channels: [],
        hourly: [],
      });

      // « a » (5 + 1) et « d » (6) sont à égalité : l'identifiant départage.
      expect(await store.leaderboard(g, "messages", "2026-11-01", 2)).toEqual([
        { memberId: "b", value: 9 },
        { memberId: "a", value: 6 },
      ]);
      // Depuis le 5 : « a » ne compte plus que 1 message ; « c » n'a aucun message.
      expect(await store.leaderboard(g, "messages", "2026-11-05", 10)).toEqual([
        { memberId: "b", value: 9 },
        { memberId: "d", value: 6 },
        { memberId: "a", value: 1 },
      ]);
      expect(await store.leaderboard(g, "voiceSeconds", "2026-11-01", 10)).toEqual([
        { memberId: "c", value: 100 },
      ]);
    });

    test("guildTotals somme la période et compte les membres actifs", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [
          daily(g, "a", "2026-11-05", { messages: 2, joins: 1 }),
          daily(g, "b", "2026-11-05", { voiceSeconds: 60 }),
          daily(g, "c", "2026-11-05", { reactionsReceived: 3 }), // pas d'activité propre
          daily(g, "a", "2026-10-01", { messages: 100 }), // hors période
        ],
        channels: [],
        hourly: [],
      });

      const result = await store.guildTotals(g, "2026-11-01");

      expect(result.activeMembers).toBe(2);
      expect(result.totals).toMatchObject({ messages: 2, joins: 1, voiceSeconds: 60, reactionsReceived: 3 });
      expect((await store.guildTotals(guild(), "2026-11-01")).activeMembers).toBe(0);
    });

    test("deleteMember retire les données individuelles et garde l'agrégat horaire", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [daily(g, "m", "2026-11-05", { messages: 1 }), daily(g, "o", "2026-11-05", { messages: 1 })],
        channels: [channel(g, "m", "c", "2026-11-05", 1), channel(g, "o", "c", "2026-11-05", 1)],
        hourly: [{ guildId: g, day: "2026-11-05", hour: 3, messages: 2, voiceSeconds: 0 }],
      });

      await store.deleteMember(g, "m");

      expect(await store.listForMember(g, "m")).toEqual([]);
      expect(await store.listForMember(g, "o")).toHaveLength(1);
      expect(await store.topChannels(g, "messages", "2026-11-01", 5)).toEqual([
        { channelId: "c", value: 1 },
      ]);
      expect((await store.hourlyMessages(g, "2026-11-01"))[3]).toBe(2);
    });

    test("purgeBefore supprime les trois niveaux d'agrégats", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [daily(g, "m", "2026-10-01", { messages: 1 }), daily(g, "m", "2026-11-05", { messages: 1 })],
        channels: [channel(g, "m", "c", "2026-10-01", 1), channel(g, "m", "c", "2026-11-05", 1)],
        hourly: [
          { guildId: g, day: "2026-10-01", hour: 1, messages: 1, voiceSeconds: 0 },
          { guildId: g, day: "2026-11-05", hour: 1, messages: 1, voiceSeconds: 0 },
        ],
      });

      expect(await store.purgeBefore("2026-10-15")).toBeGreaterThanOrEqual(3);
      expect(await store.listForMember(g, "m")).toHaveLength(1);
      expect((await store.hourlyMessages(g, "2026-01-01"))[1]).toBe(1);
    });
  });
}

for (const [label, create] of memberStores) {
  describe(`stockage des membres — ${label}`, () => {
    const guild = () => `g-${crypto.randomUUID()}`;
    const t = (day: number) => new Date(Date.UTC(2026, 10, day));

    test("touch crée la fiche et ne recule jamais la dernière activité", async () => {
      const store = create();
      const g = guild();

      await store.touch([{ guildId: g, memberId: "m", at: t(10) }]);
      await store.touch([{ guildId: g, memberId: "m", at: t(5) }]);
      await store.touch([
        { guildId: g, memberId: "m", at: t(12) },
        { guildId: g, memberId: "m", at: t(11) },
      ]);

      expect(await store.find(g, "m")).toMatchObject({
        firstSeenAt: t(10),
        lastActiveAt: t(12),
        joinedAt: null,
        leftAt: null,
      });
      expect(await store.find(g, "inconnu")).toBeNull();
    });

    test("seed crée les fiches manquantes sans écraser l'existant", async () => {
      const store = create();
      const g = guild();

      await store.touch([{ guildId: g, memberId: "a", at: t(3) }]);
      await store.seed(
        g,
        [
          { memberId: "a", joinedAt: t(1) },
          { memberId: "b", joinedAt: null },
        ],
        t(20),
      );
      await store.seed(g, [{ memberId: "a", joinedAt: t(2) }], t(21));

      expect(await store.find(g, "a")).toMatchObject({
        firstSeenAt: t(3),
        lastActiveAt: t(3),
        joinedAt: t(1),
      });
      expect(await store.find(g, "b")).toMatchObject({
        firstSeenAt: t(20),
        lastActiveAt: null,
        joinedAt: null,
      });
    });

    test("arrivée, départ et retour", async () => {
      const store = create();
      const g = guild();

      await store.markJoined(g, "m", t(1));
      await store.markLeft(g, "m", t(5));
      expect(await store.find(g, "m")).toMatchObject({ joinedAt: t(1), leftAt: t(5) });

      await store.markJoined(g, "m", t(8));
      expect(await store.find(g, "m")).toMatchObject({ joinedAt: t(8), leftAt: null });

      await store.markLeft(g, "inconnu", t(9));
      expect(await store.find(g, "inconnu")).toMatchObject({ leftAt: t(9), firstSeenAt: t(9) });
    });

    test("listInactive ordonne du plus inactif au moins inactif, sans les partis ni les actifs", async () => {
      const store = create();
      const g = guild();

      await store.seed(
        g,
        ["never", "old", "recent", "gone"].map((memberId) => ({ memberId, joinedAt: null })),
        t(1),
      );
      await store.touch([
        { guildId: g, memberId: "old", at: t(3) },
        { guildId: g, memberId: "recent", at: t(24) },
      ]);
      await store.markLeft(g, "gone", t(10));

      const inactive = await store.listInactive(g, t(20), 10);

      // « never » est mesuré depuis sa première observation (le 1er), « old » depuis le 3.
      expect(inactive.map((profile) => profile.memberId)).toEqual(["never", "old"]);
      expect((await store.listInactive(g, t(20), 1)).map((p) => p.memberId)).toEqual(["never"]);
    });

    test("delete et purgeLeftBefore", async () => {
      const store = create();
      const g = guild();

      await store.markLeft(g, "old-leaver", t(1));
      await store.markLeft(g, "recent-leaver", t(25));
      await store.touch([{ guildId: g, memberId: "present", at: t(2) }]);
      await store.touch([{ guildId: g, memberId: "forgotten", at: t(2) }]);

      await store.delete(g, "forgotten");
      expect(await store.find(g, "forgotten")).toBeNull();

      expect(await store.purgeLeftBefore(t(10))).toBeGreaterThanOrEqual(1);
      expect(await store.find(g, "old-leaver")).toBeNull();
      expect(await store.find(g, "recent-leaver")).not.toBeNull();
      expect(await store.find(g, "present")).not.toBeNull();
    });

    test("nom et photo : posés au seed, mis à jour, conservés par les autres écritures, jamais créés de rien", async () => {
      const store = create();
      const g = guild();

      await store.seed(g, [{ memberId: "m", joinedAt: null, identity: { displayName: "Aiko", avatar: "hash1" } }, { memberId: "sans-nom", joinedAt: null }], t(1));
      expect(await store.find(g, "m")).toMatchObject({ displayName: "Aiko", avatar: "hash1" });
      expect((await store.find(g, "sans-nom"))?.displayName ?? null).toBeNull();

      await store.setIdentity(g, "m", { displayName: "Aiko 2", avatar: null });
      expect(await store.find(g, "m")).toMatchObject({ displayName: "Aiko 2", avatar: null });

      // Un re-seed sans nom ne l'efface pas ; l'activité, l'arrivée et le départ non plus.
      await store.seed(g, [{ memberId: "m", joinedAt: t(2) }], t(3));
      await store.touch([{ guildId: g, memberId: "m", at: t(4) }]);
      await store.markJoined(g, "m", t(5));
      await store.markLeft(g, "m", t(6));
      expect(await store.find(g, "m")).toMatchObject({ displayName: "Aiko 2" });

      // Pas de fiche : setIdentity n'en crée pas.
      await store.setIdentity(g, "inconnu", { displayName: "Fantôme", avatar: null });
      expect(await store.find(g, "inconnu")).toBeNull();
    });
  });
}

describe("PostgreSQL — schéma de suivi", () => {
  test("RLS est activé sur les tables de suivi", async () => {
    const result = await pglite.query<{ relrowsecurity: boolean }>(
      "SELECT relrowsecurity FROM pg_class WHERE relname IN ('activity_channel_daily','activity_hourly','member_profile')",
    );

    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  test("la base refuse une heure hors de 0-23", async () => {
    await expect(
      pglite.query("INSERT INTO activity_hourly (guild_id, day, hour, messages) VALUES ('g', '2026-11-01', 24, 1)"),
    ).rejects.toThrow();
  });
});

import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import { MemoryPhaethonStore } from "@/database/in-memory/memory-phaethon-store.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresActivityStore } from "@/database/postgres/repositories/postgres-activity-store.ts";
import { PostgresMemberStore } from "@/database/postgres/repositories/postgres-member-store.ts";
import { PostgresPhaethonStore } from "@/database/postgres/repositories/postgres-phaethon-store.ts";
import type { ActivityStore } from "@/domain/activity/activity-store.ts";
import { countersWith } from "@/domain/activity/counters.ts";
import type { MemberStore } from "@/domain/members/member-store.ts";
import type { PhaethonStore } from "@/domain/phaethon/phaethon-store.ts";
import {
  EMPTY_PHAETHON_BATCH,
  type EdgeSnapshot,
  type IdentityEvent,
} from "@/domain/phaethon/phaethon-types.ts";

const pglite = new PGlite();
const database = drizzle(pglite) as unknown as Database;
await migrate(database);
afterAll(async () => {
  await pglite.close();
});

const phaethonStores: [string, () => PhaethonStore][] = [
  ["mémoire", () => new MemoryPhaethonStore()],
  ["PostgreSQL (PGlite)", () => new PostgresPhaethonStore(database)],
];
const activityStores: [string, () => ActivityStore][] = [
  ["mémoire", () => new MemoryActivityStore()],
  ["PostgreSQL (PGlite)", () => new PostgresActivityStore(database)],
];
const memberStores: [string, () => MemberStore][] = [
  ["mémoire", () => new MemoryMemberStore()],
  ["PostgreSQL (PGlite)", () => new PostgresMemberStore(database)],
];

const edge = (
  guildId: string,
  memberId: string,
  targetId: string,
  day: string,
  values: Partial<EdgeSnapshot> = {},
): EdgeSnapshot => ({
  guildId,
  memberId,
  targetId,
  day,
  replies: 0,
  mentions: 0,
  reactions: 0,
  voiceSeconds: 0,
  ...values,
});

const identity = (guildId: string, memberId: string, kind: IdentityEvent["kind"], at: Date): IdentityEvent => ({
  id: crypto.randomUUID(),
  guildId,
  memberId,
  kind,
  oldValue: "avant",
  newValue: "après",
  at,
});

for (const [label, create] of phaethonStores) {
  describe(`stockage Phaéthon — ${label}`, () => {
    // Chaque test utilise son propre serveur : les stores PostgreSQL partagent une base.
    const guild = () => `g-${crypto.randomUUID()}`;

    test("add additionne les interactions, y compris les doublons d'un lot", async () => {
      const store = create();
      const g = guild();

      await store.add({
        ...EMPTY_PHAETHON_BATCH,
        edges: [
          edge(g, "a", "b", "2026-11-01", { replies: 1, voiceSeconds: 30 }),
          edge(g, "a", "b", "2026-11-01", { replies: 2, mentions: 1 }),
        ],
      });
      await store.add({ ...EMPTY_PHAETHON_BATCH, edges: [edge(g, "a", "b", "2026-11-01", { reactions: 4 })] });

      const rows = await store.edgesForMember(g, "a", "2026-11-01");

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ replies: 3, mentions: 1, reactions: 4, voiceSeconds: 30 });
    });

    test("edgesForMember couvre les deux sens, edgesBetween seulement la paire, contactIds les deux côtés", async () => {
      const store = create();
      const g = guild();

      await store.add({
        ...EMPTY_PHAETHON_BATCH,
        edges: [
          edge(g, "a", "b", "2026-11-02", { replies: 1 }),
          edge(g, "c", "a", "2026-11-02", { replies: 1 }),
          edge(g, "b", "c", "2026-11-02", { replies: 1 }),
          edge(g, "a", "d", "2026-10-01", { replies: 1 }),
        ],
      });

      expect(await store.edgesForMember(g, "a", "2026-11-01")).toHaveLength(2);
      expect(await store.edgesBetween(g, "a", "b", "2026-11-01")).toHaveLength(1);
      expect([...(await store.contactIds(g, "a", "2026-11-01"))].sort()).toEqual(["b", "c"]);
    });

    test("les heures, la présence et les jeux s'additionnent et se filtrent par jour", async () => {
      const store = create();
      const g = guild();

      await store.add({
        ...EMPTY_PHAETHON_BATCH,
        hours: [
          { guildId: g, memberId: "a", day: "2026-11-02", hour: 23, messages: 2 },
          { guildId: g, memberId: "a", day: "2026-11-02", hour: 23, messages: 1 },
          { guildId: g, memberId: "b", day: "2026-11-02", hour: 9, messages: 5 },
          { guildId: g, memberId: "a", day: "2026-09-01", hour: 1, messages: 9 },
        ],
        statuses: [
          { guildId: g, memberId: "a", day: "2026-11-02", status: "online", seconds: 100 },
          { guildId: g, memberId: "a", day: "2026-11-02", status: "online", seconds: 50 },
          { guildId: g, memberId: "a", day: "2026-11-02", status: "dnd", seconds: 10 },
        ],
        games: [
          { guildId: g, memberId: "a", day: "2026-11-02", name: "Celeste", kind: "playing", seconds: 60 },
          { guildId: g, memberId: "a", day: "2026-11-03", name: "Celeste", kind: "playing", seconds: 40 },
          { guildId: g, memberId: "a", day: "2026-11-03", name: "Hades", kind: "playing", seconds: 10 },
          { guildId: g, memberId: "b", day: "2026-11-03", name: "100% Orange Juice", kind: "playing", seconds: 5 },
        ],
      });

      const hours = await store.hoursForMember(g, "a", "2026-11-01");
      expect(hours).toHaveLength(24);
      expect(hours[23]).toBe(3);
      expect(hours[1]).toBe(0);
      expect([...(await store.hoursByMember(g, "2026-11-01"))].sort((x, y) => x.hour - y.hour)).toEqual([
        { memberId: "b", hour: 9, messages: 5 },
        { memberId: "a", hour: 23, messages: 3 },
      ]);
      expect(await store.presenceForMember(g, "a", "2026-11-01")).toEqual({ online: 150, idle: 0, dnd: 10 });
      expect(await store.gamesForMember(g, "a", "2026-11-01", 1)).toEqual([
        { name: "Celeste", kind: "playing", seconds: 100 },
      ]);
      expect(await store.membersPlaying(g, "2026-11-01", "cele")).toEqual(["a"]);
      expect(await store.membersPlaying(g, "2026-11-01", "100%")).toEqual(["b"]);
      expect(await store.membersPlaying(g, "2026-11-01", "%")).toEqual(["b"]);
    });

    test("l'historique d'identité est trié, dédoublonné par id et compté sur 24 h", async () => {
      const store = create();
      const g = guild();
      const old = identity(g, "a", "nickname", new Date("2026-11-01T10:00:00Z"));
      const recent = identity(g, "a", "avatar", new Date("2026-11-05T10:00:00Z"));
      const role = identity(g, "a", "roles", new Date("2026-11-05T11:00:00Z"));

      await store.add({ ...EMPTY_PHAETHON_BATCH, identity: [old, recent, role] });
      await store.add({ ...EMPTY_PHAETHON_BATCH, identity: [recent] });

      const history = await store.identityHistory(g, "a", 10);

      expect(history.map((event) => event.kind)).toEqual(["roles", "avatar", "nickname"]);
      expect(history[2]?.at).toBeInstanceOf(Date);
      // Les rôles ne comptent pas comme un changement de nom.
      expect(await store.identityChangeCounts(g, new Date("2026-11-05T00:00:00Z"))).toEqual([
        { memberId: "a", count: 1 },
      ]);
    });

    test("claimAlert n'accorde une clé qu'une fois", async () => {
      const store = create();
      const g = guild();

      expect(await store.claimAlert(g, "gone-quiet:a:2026-11-01", new Date())).toBe(true);
      expect(await store.claimAlert(g, "gone-quiet:a:2026-11-01", new Date())).toBe(false);
      expect(await store.claimAlert(g, "gone-quiet:b:2026-11-01", new Date())).toBe(true);
    });

    test("deleteMember efface un membre comme source et comme cible, ses alertes comprises", async () => {
      const store = create();
      const g = guild();

      await store.add({
        ...EMPTY_PHAETHON_BATCH,
        edges: [
          edge(g, "a", "b", "2026-11-02", { replies: 1 }),
          edge(g, "b", "a", "2026-11-02", { replies: 1 }),
          edge(g, "b", "c", "2026-11-02", { replies: 1 }),
        ],
        hours: [{ guildId: g, memberId: "a", day: "2026-11-02", hour: 3, messages: 1 }],
        statuses: [{ guildId: g, memberId: "a", day: "2026-11-02", status: "idle", seconds: 5 }],
        games: [{ guildId: g, memberId: "a", day: "2026-11-02", name: "X", kind: "playing", seconds: 5 }],
        identity: [identity(g, "a", "nickname", new Date())],
      });
      await store.claimAlert(g, "activity-spike:a:2026-11-02", new Date());
      await store.claimAlert(g, "activity-spike:b:2026-11-02", new Date());

      await store.deleteMember(g, "a");

      expect(await store.edgesForMember(g, "a", "2026-01-01")).toEqual([]);
      expect(await store.edgesForMember(g, "b", "2026-01-01")).toHaveLength(1);
      expect((await store.hoursForMember(g, "a", "2026-01-01")).every((value) => value === 0)).toBe(true);
      expect(await store.presenceForMember(g, "a", "2026-01-01")).toEqual({ online: 0, idle: 0, dnd: 0 });
      expect(await store.identityHistory(g, "a", 5)).toEqual([]);
      expect(await store.claimAlert(g, "activity-spike:a:2026-11-02", new Date())).toBe(true);
      expect(await store.claimAlert(g, "activity-spike:b:2026-11-02", new Date())).toBe(false);
    });

    test("purgeBefore retire les jours périmés, les identités et alertes anciennes", async () => {
      const store = create();
      const g = guild();

      await store.add({
        ...EMPTY_PHAETHON_BATCH,
        edges: [edge(g, "a", "b", "2026-09-01", { replies: 1 }), edge(g, "a", "b", "2026-11-02", { replies: 1 })],
        hours: [{ guildId: g, memberId: "a", day: "2026-09-01", hour: 3, messages: 1 }],
        identity: [
          identity(g, "a", "nickname", new Date("2026-09-01T00:00:00Z")),
          identity(g, "a", "avatar", new Date("2026-11-02T00:00:00Z")),
        ],
      });
      await store.claimAlert(g, "old", new Date("2026-09-01T00:00:00Z"));
      await store.claimAlert(g, "new", new Date("2026-11-02T00:00:00Z"));

      const removed = await store.purgeBefore("2026-10-06", new Date("2026-10-06T00:00:00Z"));

      // Purge globale : d'autres tests partagent la base PostgreSQL, on vérifie au moins nos lignes.
      expect(removed).toBeGreaterThanOrEqual(4);
      expect(await store.edgesForMember(g, "a", "2026-01-01")).toHaveLength(1);
      expect(await store.identityHistory(g, "a", 5)).toHaveLength(1);
      expect(await store.claimAlert(g, "old", new Date())).toBe(true);
      expect(await store.claimAlert(g, "new", new Date())).toBe(false);
    });
  });
}

for (const [label, create] of activityStores) {
  describe(`stockage d'activité (Phaéthon) — ${label}`, () => {
    const guild = () => `g-${crypto.randomUUID()}`;
    const row = (g: string, memberId: string, day: string, counters: Parameters<typeof countersWith>[0]) => ({
      guildId: g,
      memberId,
      day,
      ...countersWith(counters),
    });

    test("totalsByMember et channelsForMember n'agrègent que la fenêtre demandée", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [
          row(g, "a", "2026-11-02", { messages: 3, voiceSeconds: 10 }),
          row(g, "a", "2026-11-03", { messages: 2 }),
          row(g, "a", "2026-09-01", { messages: 100 }),
          row(g, "b", "2026-11-03", { messages: 7 }),
        ],
        channels: [
          { guildId: g, memberId: "a", channelId: "c1", day: "2026-11-02", messages: 3, voiceSeconds: 10 },
          { guildId: g, memberId: "a", channelId: "c2", day: "2026-11-03", messages: 2, voiceSeconds: 0 },
          { guildId: g, memberId: "b", channelId: "c1", day: "2026-11-03", messages: 7, voiceSeconds: 0 },
        ],
        hourly: [],
      });

      const totals = await store.totalsByMember(g, "2026-11-01");

      expect(totals.map((entry) => [entry.memberId, entry.messages]).sort()).toEqual([
        ["a", 5],
        ["b", 7],
      ]);
      expect(await store.channelsForMember(g, "a", "messages", "2026-11-01", 5)).toEqual([
        { channelId: "c1", value: 3 },
        { channelId: "c2", value: 2 },
      ]);
      expect(await store.channelsForMember(g, "a", "voiceSeconds", "2026-11-01", 5)).toEqual([
        { channelId: "c1", value: 10 },
      ]);
    });

    test("la purge résume le détail par mois avant de le supprimer, sans jamais doubler un mois", async () => {
      const store = create();
      const g = guild();

      await store.add({
        daily: [
          row(g, "a", "2026-08-30", { messages: 4, characters: 40 }),
          row(g, "a", "2026-08-31", { voiceSeconds: 60 }),
          row(g, "a", "2026-09-01", { messages: 6, reactionsGiven: 2 }),
          row(g, "a", "2026-11-04", { messages: 9 }),
        ],
        channels: [],
        hourly: [],
      });

      await store.purgeBefore("2026-10-06");
      // Une seconde purge, plus tard, ne doit pas recompter les mois déjà résumés.
      await store.add({ daily: [row(g, "a", "2026-09-02", { messages: 1 })], channels: [], hourly: [] });
      await store.purgeBefore("2026-10-06");

      const monthly = await store.monthlyForMember(g, "a", 6);

      expect(monthly.map((month) => month.month)).toEqual(["2026-09", "2026-08"]);
      expect(monthly[1]).toMatchObject({ messages: 4, characters: 40, voiceSeconds: 60, activeDays: 2 });
      expect(monthly[0]).toMatchObject({ messages: 7, reactionsGiven: 2, activeDays: 2 });
      expect(await store.listForMember(g, "a")).toHaveLength(1);
      expect(await store.monthlyForMember(g, "a", 1)).toHaveLength(1);

      await store.deleteMember(g, "a");
      expect(await store.monthlyForMember(g, "a", 6)).toEqual([]);
    });
  });
}

for (const [label, create] of memberStores) {
  describe(`stockage des fiches (Phaéthon) — ${label}`, () => {
    const guild = () => `g-${crypto.randomUUID()}`;

    test("listPresent exclut les membres partis et listLeftBefore donne ceux à purger", async () => {
      const store = create();
      const g = guild();
      const now = new Date("2026-11-05T00:00:00Z");

      await store.seed(g, [{ memberId: "ici", joinedAt: null }, { memberId: "parti", joinedAt: null }, { memberId: "recent", joinedAt: null }], now);
      await store.markLeft(g, "parti", new Date("2026-09-01T00:00:00Z"));
      await store.markLeft(g, "recent", new Date("2026-11-04T00:00:00Z"));

      expect((await store.listPresent(g)).map((profile) => profile.memberId)).toEqual(["ici"]);

      const due = (await store.listLeftBefore(new Date("2026-10-06T00:00:00Z"))).filter((entry) => entry.guildId === g);

      expect(due).toEqual([{ guildId: g, memberId: "parti" }]);
    });
  });
}

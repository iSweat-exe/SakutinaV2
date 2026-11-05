import { describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { MemoryWarningStore } from "@/database/in-memory/memory-warning-store.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresWarningStore } from "@/database/postgres/repositories/postgres-warning-store.ts";
import { ModerationService } from "@/domain/moderation/moderation-service.ts";
import {
  MAX_TIMEOUT_MS,
  evaluateSanction,
  parseDuration,
  type Party,
} from "@/domain/moderation/moderation-rules.ts";
import type { WarningStore } from "@/domain/moderation/warning-store.ts";

const pglite = new PGlite();
const database = drizzle(pglite) as unknown as Database;
await migrate(database);

test("les durées de timeout se lisent en minutes, heures et jours, dans les bornes de Discord", () => {
  expect(parseDuration("30m")).toBe(30 * 60_000);
  expect(parseDuration("90")).toBe(90 * 60_000);
  expect(parseDuration("2h")).toBe(2 * 3_600_000);
  expect(parseDuration(" 7 d ")).toBe(7 * 86_400_000);
  expect(parseDuration("3J")).toBe(3 * 86_400_000);
  expect(parseDuration("28d")).toBe(MAX_TIMEOUT_MS);
  expect(parseDuration("29d")).toBeNull();
  expect(parseDuration("0m")).toBeNull();
  expect(parseDuration("10x")).toBeNull();
  expect(parseDuration("abc")).toBeNull();
  expect(parseDuration("-5m")).toBeNull();
  expect(parseDuration("")).toBeNull();
});

const party = (overrides: Partial<Party> = {}): Party => ({
  id: "x",
  role: "member",
  isGuildOwner: false,
  position: 1,
  ...overrides,
});
const check = (actor: Partial<Party>, target: Partial<Party> | null, botCanAct = true, targetId = "cible") =>
  evaluateSanction({
    actor: party({ id: "acteur", role: "moderator", position: 10, ...actor }),
    targetId,
    target: target ? party({ id: targetId, ...target }) : null,
    botId: "bot",
    botCanAct,
  });

describe("garde-fous de hiérarchie", () => {
  test("un modérateur peut sanctionner un membre plus bas que lui", () => {
    expect(check({}, { role: "member", position: 5 })).toBeNull();
  });

  test("on ne se sanctionne pas soi-même, ni le bot, ni le propriétaire", () => {
    expect(check({}, { role: "member", position: 1 }, true, "acteur")).toBe("self");
    expect(check({}, { role: "member", position: 1 }, true, "bot")).toBe("bot");
    expect(check({}, { role: "member", isGuildOwner: true })).toBe("owner");
    expect(check({ role: "owner", isGuildOwner: true }, { role: "member", isGuildOwner: true })).toBe("owner");
  });

  test("on ne sanctionne pas un rôle égal ou supérieur, même avec une position plus haute", () => {
    expect(check({}, { role: "moderator", position: 1 })).toBe("role");
    expect(check({}, { role: "admin", position: 1 })).toBe("role");
    expect(check({ role: "admin" }, { role: "admin", position: 1 })).toBe("role");
    expect(check({ role: "admin" }, { role: "moderator", position: 1 })).toBeNull();
  });

  test("la hiérarchie des rôles Discord s'applique, sauf au propriétaire du serveur", () => {
    expect(check({ position: 5 }, { role: "member", position: 5 })).toBe("position");
    expect(check({ position: 5 }, { role: "member", position: 9 })).toBe("position");
    expect(check({ role: "owner", isGuildOwner: true, position: 0 }, { role: "admin", position: 99 })).toBeNull();
  });

  test("le bot doit lui-même pouvoir agir sur la cible", () => {
    expect(check({}, { role: "member", position: 1 }, false)).toBe("bot-position");
  });

  test("une cible absente du serveur ne laisse que les contrôles d'identité", () => {
    expect(check({}, null)).toBeNull();
    expect(check({}, null, false)).toBeNull();
    expect(check({}, null, true, "acteur")).toBe("self");
    expect(check({}, null, true, "bot")).toBe("bot");
  });
});

const stores: [string, () => WarningStore][] = [
  ["mémoire", () => new MemoryWarningStore()],
  ["PostgreSQL (PGlite)", () => new PostgresWarningStore(database)],
];

for (const [label, create] of stores) {
  describe(`avertissements — ${label}`, () => {
    const guild = () => `g-${crypto.randomUUID()}`;
    const at = (day: number) => new Date(Date.UTC(2026, 10, day));
    const base = (g: string, memberId: string, day: number, reason = "motif") => ({
      guildId: g,
      memberId,
      moderatorId: "mod",
      reason,
      createdAt: at(day),
    });

    test("les avertissements reçoivent un numéro croissant et se listent du plus récent au plus ancien", async () => {
      const store = create();
      const g = guild();
      const first = await store.add(base(g, "m", 1, "premier"));
      const second = await store.add(base(g, "m", 3, "second"));
      await store.add(base(g, "autre", 2));

      expect(second.id).toBeGreaterThan(first.id);
      expect((await store.listForMember(g, "m", 10)).map((warning) => warning.reason)).toEqual(["second", "premier"]);
      expect((await store.listForMember(g, "m", 1)).map((warning) => warning.reason)).toEqual(["second"]);
      expect(await store.count(g, "m")).toBe(2);
      expect(await store.count(g, "inconnu")).toBe(0);
    });

    test("remove ne retire qu'un avertissement existant du bon serveur", async () => {
      const store = create();
      const g = guild();
      const warning = await store.add(base(g, "m", 1));

      expect(await store.remove("autre-serveur", warning.id)).toBe(false);
      expect(await store.remove(g, warning.id + 999)).toBe(false);
      expect(await store.remove(g, warning.id)).toBe(true);
      expect(await store.remove(g, warning.id)).toBe(false);
      expect(await store.count(g, "m")).toBe(0);
    });

    test("purgeBefore retire les avertissements anciens et garde les autres", async () => {
      const store = create();
      const g = guild();
      await store.add(base(g, "m", 1));
      await store.add(base(g, "m", 20));

      expect(await store.purgeBefore(at(10))).toBeGreaterThanOrEqual(1);
      expect(await store.count(g, "m")).toBe(1);
    });
  });
}

test("le service garde les avertissements un an et les purge ensuite", async () => {
  const now = new Date("2026-11-05T00:00:00Z");
  const store = new MemoryWarningStore();
  const service = new ModerationService(store, () => now);
  const old = await store.add({
    guildId: "g",
    memberId: "m",
    moderatorId: "mod",
    reason: "ancien",
    createdAt: new Date("2025-11-01T00:00:00Z"),
  });
  const fresh = await service.warn("g", "m", "mod", "récent");

  expect(fresh.createdAt).toEqual(now);
  expect(await service.purgeExpired(now)).toBe(1);

  const { total, latest } = await service.warnings("g", "m");

  expect(total).toBe(1);
  expect(latest.map((warning) => warning.id)).toEqual([fresh.id]);
  expect(old.id).not.toBe(fresh.id);
  expect(await service.remove("g", fresh.id)).toBe(true);
});

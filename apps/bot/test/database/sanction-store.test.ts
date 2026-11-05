import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import { MemorySanctionStore } from "@/database/in-memory/memory-sanction-store.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresSanctionStore } from "@/database/postgres/repositories/postgres-sanction-store.ts";
import { SanctionService } from "@/domain/moderation/sanction-service.ts";
import type { SanctionStore } from "@/domain/moderation/sanction-store.ts";

const pglite = new PGlite();
const database = drizzle(pglite) as unknown as Database;
await migrate(database);
afterAll(async () => {
  await pglite.close();
});

const stores: [string, () => SanctionStore][] = [
  ["mémoire", () => new MemorySanctionStore()],
  ["PostgreSQL (PGlite)", () => new PostgresSanctionStore(database)],
];

const at = (offsetMs: number) => new Date(Date.UTC(2026, 10, 5, 12) + offsetMs);
const MINUTE = 60_000;

for (const [label, create] of stores) {
  describe(`sanctions — ${label}`, () => {
    const guild = () => `g-${crypto.randomUUID()}`;
    const service = (store: SanctionStore, now = at(0)) => new SanctionService(store, () => now);

    test("un mute est actif jusqu'à sa fin, un bannissement jusqu'à ce qu'il soit levé", async () => {
      const store = create();
      const g = guild();
      const s = service(store);

      await s.recordMute(g, "m", "mod", "spam", 30 * MINUTE);
      await s.recordBan(g, "b", "admin", "raid");

      expect(await store.hasActive(g, "m", "mute", at(29 * MINUTE))).toBe(true);
      expect(await store.hasActive(g, "m", "mute", at(31 * MINUTE))).toBe(false);
      expect(await store.hasActive(g, "b", "ban", at(365 * 24 * 60 * MINUTE))).toBe(true);
      expect(await store.hasActive(g, "b", "mute", at(0))).toBe(false);
    });

    test("une nouvelle sanction du même type remplace l'active ; clear la clôt et dit combien", async () => {
      const store = create();
      const g = guild();
      const s = service(store);

      const first = await s.recordMute(g, "m", "mod", "premier", 60 * MINUTE);
      const second = await s.recordMute(g, "m", "mod", "second", 60 * MINUTE);

      expect((await store.find(first.id))?.revokedAt).not.toBeNull();
      expect((await store.find(second.id))?.revokedAt).toBeNull();
      expect(await s.clear("mute", g, "m", "admin")).toBe(1);
      expect(await s.clear("mute", g, "m", "admin")).toBe(0);
      expect(await store.find(second.id)).toMatchObject({ revokedBy: "admin" });
      // Un mute levé ne touche pas un bannissement du même membre.
      await s.recordBan(g, "m", "mod", "ban");
      expect(await s.clear("mute", g, "m", null)).toBe(0);
      expect(await store.hasActive(g, "m", "ban", at(0))).toBe(true);
    });

    test("une sanction vue dans Discord n'est enregistrée que si le bot ne la connaît pas", async () => {
      const store = create();
      const g = guild();
      const s = service(store);

      expect(await s.recordUnknownIfAbsent("ban", g, "x", "—", null)).toBe(true);
      expect(await s.recordUnknownIfAbsent("ban", g, "x", "—", null)).toBe(false);
      await s.recordBan(g, "y", "admin", "raid");
      expect(await s.recordUnknownIfAbsent("ban", g, "y", "—", null)).toBe(false);
      expect(await s.recordUnknownIfAbsent("mute", g, "z", "—", at(10 * MINUTE))).toBe(true);
      expect(await store.hasActive(g, "z", "mute", at(5 * MINUTE))).toBe(true);
    });

    test("la purge supprime les sanctions closées ou échues depuis plus de 30 jours, jamais les actives", async () => {
      const store = create();
      const g = guild();
      const day = 24 * 60 * MINUTE;

      await service(store, at(-40 * day)).recordMute(g, "vieux-mute", "mod", "x", 60 * MINUTE);
      await service(store, at(-40 * day)).recordBan(g, "vieux-leve", "admin", "x");
      await service(store, at(-35 * day)).clear("ban", g, "vieux-leve", "admin");
      await service(store, at(-40 * day)).recordBan(g, "vieux-actif", "admin", "x");
      await service(store, at(-1 * day)).recordMute(g, "recent", "mod", "x", 60 * MINUTE);

      const removed = await service(store, at(0)).purgeExpired();

      // Le mute échu et le bannissement levé, tous deux vieux de plus de 30 jours.
      expect(removed).toBeGreaterThanOrEqual(2);

      expect(await store.hasActive(g, "vieux-actif", "ban", at(0))).toBe(true);
      expect(await store.hasActive(g, "recent", "mute", at(-1 * day + 30 * MINUTE))).toBe(true);
    });

    test("la file : les demandes en attente sortent dans l'ordre et disparaissent une fois traitées", async () => {
      const store = create();
      const g = guild();

      await store.enqueueCommand(g, 1, "admin-a");
      await store.enqueueCommand(g, 2, "admin-b");

      const pending = await store.pendingCommands(10);
      expect(pending.filter((c) => c.guildId === g).map((c) => [c.sanctionId, c.requestedBy])).toEqual([
        [1, "admin-a"],
        [2, "admin-b"],
      ]);

      await store.finishCommand(pending.find((c) => c.guildId === g && c.sanctionId === 1)!.id, "done", at(0));
      await store.finishCommand(pending.find((c) => c.guildId === g && c.sanctionId === 2)!.id, "failed", at(0), "Missing Permissions");
      expect((await store.pendingCommands(10)).filter((c) => c.guildId === g)).toEqual([]);
    });
  });
}

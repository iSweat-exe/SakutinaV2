import { defaultSettings } from "@/domain/guilds/guild-types.ts";
import { expect, test } from "bun:test";

import { MemoryGuildStore } from "@/database/in-memory/memory-guild-store.ts";
import { GuildService, SETTINGS_TTL_MS } from "@/domain/guilds/guild-service.ts";

const guild = (guildId: string) => ({ guildId, name: guildId, icon: null, banner: null, ownerId: "owner", memberCount: 3 });

test("un serveur sans réglages reçoit les valeurs par défaut", async () => {
  const service = new GuildService(new MemoryGuildStore());

  expect(await service.settings("g")).toEqual({ ...defaultSettings("g"), adminRoleIds: [], moderatorRoleIds: [], alertChannelId: null });
});

test("les réglages sont gardés quelques secondes en cache, puis relus (le panneau les change en base)", async () => {
  const store = new MemoryGuildStore();
  let now = 0;
  const service = new GuildService(store, () => now);

  expect((await service.settings("g")).alertChannelId).toBeNull();
  store.settings.set("g", { ...defaultSettings("g"), adminRoleIds: [], moderatorRoleIds: [], alertChannelId: "salon" });
  expect((await service.settings("g")).alertChannelId).toBeNull();

  now = SETTINGS_TTL_MS + 1;
  expect((await service.settings("g")).alertChannelId).toBe("salon");
});

test("les anciens réglages par variables d'environnement sont repris une seule fois, et seulement s'il y en a", async () => {
  const store = new MemoryGuildStore();
  const service = new GuildService(store);
  const legacy = { ...defaultSettings("g"), adminRoleIds: ["r1"], moderatorRoleIds: [], alertChannelId: null };

  expect(await service.seedLegacySettings({ ...legacy, adminRoleIds: [] })).toBe(false);
  expect(await service.seedLegacySettings(legacy)).toBe(true);
  expect(await service.seedLegacySettings({ ...legacy, adminRoleIds: ["r2"] })).toBe(false);
  expect((await service.settings("g")).adminRoleIds).toEqual(["r1"]);
});

test("synchroniser écrit la fiche et dédoublonne les gestionnaires ; retain oublie les serveurs quittés", async () => {
  const store = new MemoryGuildStore();
  const service = new GuildService(store);

  await service.sync(guild("a"), ["m1", "m1", "m2"]);
  await service.sync(guild("b"), []);

  expect(store.managers.get("a")).toEqual(["m1", "m2"]);
  expect(await service.retain(["a"])).toBe(1);
  expect([...store.guilds.keys()]).toEqual(["a"]);
  expect(store.managers.has("b")).toBe(false);
});

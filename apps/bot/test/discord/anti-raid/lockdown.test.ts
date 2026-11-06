import { expect, test } from "bun:test";
import { ChannelType } from "discord.js";

import { MemoryRaidStore } from "@/database/in-memory/memory-raid-store.ts";
import { lockGuild, restoreGuild } from "@/discord/anti-raid/lockdown.ts";
import { DEFAULT_ANTI_RAID } from "@/domain/anti-raid/anti-raid-rules.ts";
import { AntiRaidService } from "@/domain/anti-raid/anti-raid-service.ts";
import { LOCK_BITS } from "@/domain/anti-raid/overwrites.ts";
import { channel, fakeGuild, overwriteOf, SEND, VIEW } from "./support.ts";

async function raidOn() {
  const store = new MemoryRaidStore();
  const antiRaid = new AntiRaidService(store, async () => DEFAULT_ANTI_RAID);
  const started = await antiRaid.startManual("guild-1", "admin");
  return { store, antiRaid, raidId: started!.raid.id };
}

test("verrouiller puis lever rend chaque salon exactement comme avant", async () => {
  const general = channel("general", { allow: SEND | VIEW, deny: 0n });
  const memes = channel("memes", null);
  const rules = channel("rules", { allow: 0n, deny: SEND });
  const staff = channel("staff", null, false);
  const category = channel("category", null, true, ChannelType.GuildCategory);
  const guild = fakeGuild([general, memes, rules, staff, category]);
  const { antiRaid, store, raidId } = await raidOn();

  const lock = await lockGuild(guild as never, raidId, antiRaid, { channels: true, verification: true });

  expect(lock).toEqual({ locked: 2, failed: 0, verificationRaised: true });
  expect(overwriteOf(general)).toEqual({ allow: VIEW, deny: LOCK_BITS });
  expect(overwriteOf(memes)).toEqual({ allow: 0n, deny: LOCK_BITS });
  // Déjà fermé, non gérable, ou catégorie : pas touché.
  expect(guild.calls.filter((c) => c.startsWith("put:"))).toEqual(["put:general", "put:memes"]);
  expect(guild.verificationLevel).toBe(4);
  expect((await store.find(raidId))?.lockedChannels).toBe(2);

  const restore = await restoreGuild(guild as never, raidId, antiRaid);

  expect(restore).toEqual({ restored: 2, failed: 0, verificationRestored: true });
  expect(overwriteOf(general)).toEqual({ allow: SEND | VIEW, deny: 0n });
  expect(overwriteOf(memes)).toBeNull();
  expect(overwriteOf(rules)).toEqual({ allow: 0n, deny: SEND });
  expect(guild.verificationLevel).toBe(1);
  expect((await antiRaid.lockdown(raidId)).channels).toEqual([]);
});

test("l'état d'avant est enregistré avant toute modification ; un salon supprimé entre-temps est oublié", async () => {
  const general = channel("general", null);
  const gone = channel("gone", null);
  const guild = fakeGuild([general, gone]);
  const { antiRaid, raidId } = await raidOn();
  const saves: string[] = [];
  const original = antiRaid.saveLockdown.bind(antiRaid);
  antiRaid.saveLockdown = async (...args) => {
    saves.push(`save:${guild.calls.length}`);
    return original(...args);
  };

  await lockGuild(guild as never, raidId, antiRaid, { channels: true, verification: false });
  expect(saves).toEqual(["save:0"]);

  guild.channels.cache.delete("gone");
  expect(await restoreGuild(guild as never, raidId, antiRaid)).toMatchObject({ restored: 1, failed: 0 });
  expect((await antiRaid.lockdown(raidId)).channels).toEqual([]);
});

test("une modification faite pendant le raid n'est pas effacée ; la vérification changée par un admin non plus", async () => {
  const general = channel("general", null);
  const guild = fakeGuild([general], { verificationLevel: 2 });
  const { antiRaid, raidId } = await raidOn();

  await lockGuild(guild as never, raidId, antiRaid, { channels: true, verification: true });
  // Un admin cache le salon et règle lui-même la vérification pendant le raid.
  general.permissionOverwrites.cache.get("guild-1")!.deny.bitfield |= VIEW;
  guild.verificationLevel = 3;

  expect(await restoreGuild(guild as never, raidId, antiRaid)).toMatchObject({ restored: 1, verificationRestored: false });
  expect(overwriteOf(general)).toEqual({ allow: 0n, deny: VIEW });
  expect(guild.verificationLevel).toBe(3);
});

test("sans « Gérer le serveur », la vérification n'est pas touchée ; un échec laisse le salon à rétablir", async () => {
  const general = channel("general", null);
  const guild = fakeGuild([general], { manageGuild: false });
  const { antiRaid, raidId } = await raidOn();

  expect(await lockGuild(guild as never, raidId, antiRaid, { channels: true, verification: true })).toMatchObject({ verificationRaised: false });

  guild.client.rest.delete = async () => {
    throw new Error("Missing Permissions");
  };
  expect(await restoreGuild(guild as never, raidId, antiRaid)).toMatchObject({ restored: 0, failed: 1 });
  expect((await antiRaid.lockdown(raidId)).channels.map((c) => c.channelId)).toEqual(["general"]);
});

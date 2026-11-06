import { expect, test } from "bun:test";

import { QUARANTINE_MS, RAID_CALM_MS } from "@/domain/anti-raid/anti-raid-rules.ts";
import { channel, fakeGuild, member, overwriteOf, SEND, setup } from "./support.ts";

test("une rafale déclare un raid : salons verrouillés, comptes de la fenêtre en quarantaine, alerte, audit", async () => {
  const general = channel("general", { allow: SEND, deny: 0n });
  const guild = fakeGuild([general]);
  const { guard, store, sanctionStore, posted, actions } = setup(guild);
  const joiners = ["1000001", "1000002", "1000003"].map((id) => member(guild, id));

  expect(await guard.onJoin(joiners[0] as never)).toBe(false);
  expect(await guard.onJoin(joiners[1] as never)).toBe(false);
  expect(joiners[0]!.timeouts).toEqual([]);
  expect(await guard.onJoin(joiners[2] as never)).toBe(false);

  for (const joiner of joiners) {
    expect(joiner.timeouts).toEqual([QUARANTINE_MS]);
  }

  const [raid] = await store.active();
  expect(raid).toMatchObject({ trigger: "burst", joins: 3, actioned: 3, lockedChannels: 1 });
  expect(overwriteOf(general)?.deny).not.toBe(0n);
  expect(posted).toHaveLength(1);
  expect(await sanctionStore.hasActive(guild.id, "1000001", "mute", new Date())).toBe(true);
  expect(await actions()).toEqual(["antiraid.quarantine", "antiraid.quarantine", "antiraid.quarantine", "antiraid.started"]);

  // Un arrivant suivant fait partie du raid.
  const late = member(guild, "1000004");
  await guard.onJoin(late as never);
  expect(late.timeouts).toEqual([QUARANTINE_MS]);
  expect((await store.active())[0]).toMatchObject({ joins: 4, actioned: 4 });
});

test("bannissement : le compte quitte le serveur ; le propriétaire, un admin et un bot ne sont jamais visés ; un refus est compté", async () => {
  const guild = fakeGuild([]);
  const { guard, store } = setup(guild, { action: "ban", lockChannels: false });
  const owner = member(guild, "owner");
  const admin = member(guild, "1000002", { admin: true });
  const raider = member(guild, "1000003");

  await guard.onJoin(owner as never);
  await guard.onJoin(admin as never);
  expect(await guard.onJoin(raider as never)).toBe(true);
  expect(guild.banned).toEqual(["1000003"]);

  const kickGuild = fakeGuild([]);
  const kick = setup(kickGuild, { action: "kick", lockChannels: false, joinThreshold: 3 });
  const stubborn = member(kickGuild, "2000001", { fail: true });
  await kick.guard.onJoin(member(kickGuild, "2000002") as never);
  await kick.guard.onJoin(member(kickGuild, "2000003") as never);
  await kick.guard.onJoin(stubborn as never);
  expect((await kick.store.active())[0]).toMatchObject({ actioned: 2, failed: 1 });
  expect((await store.active())[0]).toMatchObject({ actioned: 1 });

  expect(await guard.onJoin(member(guild, "bot-1", { bot: true }) as never)).toBe(false);
});

test("mode observation : le raid est enregistré et signalé, personne n'est touché, rien n'est verrouillé", async () => {
  const general = channel("general", null);
  const guild = fakeGuild([general]);
  const { guard, store, posted } = setup(guild, { action: "watch", raiseVerification: true });
  const joiners = ["1000001", "1000002", "1000003"].map((id) => member(guild, id));

  for (const joiner of joiners) {
    await guard.onJoin(joiner as never);
  }

  expect(joiners.every((j) => j.timeouts.length === 0)).toBe(true);
  expect((await store.active())[0]).toMatchObject({ action: "watch", lockedChannels: 0 });
  expect(overwriteOf(general)).toBeNull();
  expect(guild.verificationLevel).toBe(1);
  expect(posted).toHaveLength(1);
});

test("sans alerte demandée, rien n'est publié", async () => {
  const guild = fakeGuild([]);
  const { guard, posted } = setup(guild, { alertAdmins: false });

  for (const id of ["1000001", "1000002", "1000003"]) {
    await guard.onJoin(member(guild, id) as never);
  }

  expect(posted).toEqual([]);
});

test("une rafale calme depuis 2 minutes prend fin seule et rétablit les salons", async () => {
  const general = channel("general", { allow: SEND, deny: 0n });
  const guild = fakeGuild([general]);
  const { guard, store, advance, actions, posted } = setup(guild);

  for (const id of ["1000001", "1000002", "1000003"]) {
    await guard.onJoin(member(guild, id) as never);
  }

  advance(RAID_CALM_MS - 1);
  await guard.sweep();
  expect(await store.active()).toHaveLength(1);

  advance(1);
  await guard.sweep();
  expect(await store.active()).toEqual([]);
  expect(overwriteOf(general)).toEqual({ allow: SEND, deny: 0n });
  expect(await actions()).toContain("antiraid.ended");
  expect(posted).toHaveLength(2);
});

test("verrouillage manuel : salons fermés même si le réglage est éteint, aucune fin automatique, levé par un admin", async () => {
  const general = channel("general", null);
  const guild = fakeGuild([general]);
  const { guard, store, advance } = setup(guild, { lockChannels: false, enabled: false });

  const started = await guard.lockdown(guild as never, "admin");
  expect(started?.lock.locked).toBe(1);
  expect(await guard.lockdown(guild as never, "admin")).toBeNull();

  // Un arrivant pendant le verrouillage est traité, même anti-raid éteint.
  const late = member(guild, "1000009");
  await guard.onJoin(late as never);
  expect(late.timeouts).toHaveLength(1);

  advance(RAID_CALM_MS * 10);
  await guard.sweep();
  expect(await store.active()).toHaveLength(1);

  const ended = await guard.unlock(guild as never, "admin");
  expect(ended?.raid).toMatchObject({ endedBy: "admin", startedBy: "admin", joins: 1 });
  expect(ended?.restore.restored).toBe(1);
  expect(overwriteOf(general)).toBeNull();
  expect(await guard.unlock(guild as never, "admin")).toBeNull();
});

test("demandes du panneau : verrouiller, refusé s'il y a déjà un raid, puis lever", async () => {
  const guild = fakeGuild([channel("general", null)]);
  const { guard, store } = setup(guild);

  await store.enqueueCommand(guild.id, "start", "admin");
  await store.enqueueCommand(guild.id, "start", "admin");
  await store.enqueueCommand("ailleurs", "end", "admin");
  await guard.runPanelCommands();

  expect((await store.active())[0]).toMatchObject({ trigger: "manual", startedBy: "admin" });
  expect(store.commands.map((c) => [c.status, c.error])).toEqual([
    ["done", null],
    ["failed", "Un raid est déjà en cours."],
    ["failed", "Le bot n'est plus sur ce serveur."],
  ]);

  await store.enqueueCommand(guild.id, "end", "admin2");
  await guard.runPanelCommands();
  expect(await store.active()).toEqual([]);
  expect(store.commands.at(-1)?.status).toBe("done");
});

test("un raid resté ouvert avant un redémarrage reprend", async () => {
  const guild = fakeGuild([]);
  const { guard, store, antiRaid } = setup(guild);
  await store.start({ id: "r1", guildId: guild.id, startedAt: new Date(), trigger: "manual", startedBy: "a", joins: 2, windowSeconds: 30, action: "kick" });

  await guard.resume();
  expect(antiRaid.active(guild.id)).toMatchObject({ raidId: "r1", manual: true });
});

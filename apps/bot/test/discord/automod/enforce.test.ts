import { expect, test } from "bun:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";

import { enforceAutomod } from "@/discord/automod/enforce.ts";
import { DEFAULT_AUTOMOD, defaultSettings } from "@/domain/guilds/guild-types.ts";
import { GUILD, ME, createContext } from "../../support/fakes.ts";

type Over = { text?: string; mentions?: number; roles?: string[]; permissions?: bigint; moderatable?: boolean; deleteFails?: boolean; timeoutFails?: boolean };

function scene(over: Over = {}) {
  const calls = { deleted: 0, timeouts: [] as number[], dms: 0 };
  const member = {
    id: ME,
    guild: { ownerId: "proprio" },
    joinedTimestamp: Date.now() - 86_400_000,
    moderatable: over.moderatable ?? true,
    permissions: new PermissionsBitField(over.permissions ?? 0n),
    roles: { cache: new Map((over.roles ?? []).map((id) => [id, { id }])) },
    timeout: async (ms: number | null) => {
      if (over.timeoutFails) throw new Error("Missing Permissions");
      calls.timeouts.push(ms ?? 0);
    },
  };
  const mentioned = Array.from({ length: over.mentions ?? 0 }, (_, i) => [`u${i}`, { id: `u${i}`, bot: false }] as const);
  const message = {
    guildId: GUILD,
    author: { id: ME, bot: false, createDM: async () => ({ send: async () => { calls.dms += 1; } }) },
    member,
    guild: { name: "Serveur" },
    content: over.text ?? "bonjour",
    createdTimestamp: Date.now(),
    mentions: { users: new Map(mentioned) as Map<string, { id: string; bot: boolean }> & { filter: unknown } },
    delete: async () => {
      if (over.deleteFails) throw new Error("Missing Permissions");
      calls.deleted += 1;
    },
  };
  // `Collection.filter` : une Map suffit pour le test, avec le même contrat (renvoie quelque chose qui a `size`).
  (message.mentions.users as unknown as { filter: (f: (u: { id: string; bot: boolean }) => boolean) => { size: number } }).filter = (f) => ({
    size: mentioned.filter(([, user]) => f(user)).length,
  });

  return { message: message as never, calls };
}

function setup(automod: Partial<typeof DEFAULT_AUTOMOD>) {
  const { context, guildStore, sanctionStore, auditLog } = createContext();
  guildStore.settings.set(GUILD, { ...defaultSettings(GUILD), automod: { ...DEFAULT_AUTOMOD, muteMinutes: 15, ...automod } });

  return { context, guildStore, sanctionStore, auditLog };
}

const actions = async (auditLog: ReturnType<typeof createContext>["auditLog"]) => (await auditLog.listForGuild(GUILD, 20)).map((event) => `${event.action}:${event.metadata.rule}:${event.metadata.result}`);

test("tout éteint : le message passe, rien n'est journalisé", async () => {
  const { context, auditLog } = setup({});
  const { message, calls } = scene({ text: "arnaque", mentions: 9 });

  await enforceAutomod(context, message);

  expect(calls.deleted).toBe(0);
  expect(await actions(auditLog)).toEqual([]);
});

test("mentions en masse : message supprimé, auteur réduit au silence, sanction enregistrée au nom de Sakutina, journal, message privé", async () => {
  const { context, auditLog, sanctionStore } = setup({ mentions: true });
  const { message, calls } = scene({ mentions: 6 });

  await enforceAutomod(context, message);

  expect(calls.deleted).toBe(1);
  expect(calls.timeouts).toEqual([15 * 60_000]);
  expect(calls.dms).toBe(1);
  expect(sanctionStore.sanctions).toHaveLength(1);
  expect(sanctionStore.sanctions[0]).toMatchObject({ kind: "mute", moderatorId: "sakutina", memberId: ME });
  expect((await actions(auditLog)).sort()).toEqual(["automod.delete:mentions:ok", "automod.timeout:mentions:ok"]);
});

test("mot interdit : suppression seule, aucun mute", async () => {
  const { context, auditLog, sanctionStore } = setup({ words: true, bannedWords: ["arnaque"] });
  const { message, calls } = scene({ text: "quelle arnaque" });

  await enforceAutomod(context, message);

  expect(calls.deleted).toBe(1);
  expect(calls.timeouts).toEqual([]);
  expect(sanctionStore.sanctions).toHaveLength(0);
  expect(await actions(auditLog)).toEqual(["automod.delete:words:ok"]);
});

test("les modérateurs, les administrateurs et ceux qui gèrent les messages ne sont jamais touchés", async () => {
  for (const over of [
    { permissions: PermissionFlagsBits.ModerateMembers },
    { permissions: PermissionFlagsBits.Administrator },
    { permissions: PermissionFlagsBits.ManageMessages },
  ]) {
    const { context } = setup({ words: true, bannedWords: ["arnaque"] });
    const { message, calls } = scene({ text: "arnaque", ...over });

    await enforceAutomod(context, message);
    expect(calls.deleted).toBe(0);
  }
});

test("un rôle de modérateur déclaré dans les réglages du serveur exempte aussi", async () => {
  const { context, guildStore } = setup({ words: true, bannedWords: ["arnaque"] });
  guildStore.settings.set(GUILD, { ...guildStore.settings.get(GUILD)!, moderatorRoleIds: ["role-modo"] });
  const { message, calls } = scene({ text: "arnaque", roles: ["role-modo"] });

  await enforceAutomod(context, message);

  expect(calls.deleted).toBe(0);
});

test("échecs de Discord : journalisés comme tels, sans sanction enregistrée ni plantage", async () => {
  const noDelete = setup({ mentions: true });
  const first = scene({ mentions: 6, deleteFails: true });
  await enforceAutomod(noDelete.context, first.message);
  expect((await actions(noDelete.auditLog)).sort()).toEqual(["automod.delete:mentions:failed", "automod.timeout:mentions:ok"]);

  const noTimeout = setup({ mentions: true });
  const second = scene({ mentions: 6, timeoutFails: true });
  await enforceAutomod(noTimeout.context, second.message);
  expect(noTimeout.sanctionStore.sanctions).toHaveLength(0);
  expect((await actions(noTimeout.auditLog)).sort()).toEqual(["automod.delete:mentions:ok", "automod.timeout:mentions:failed"]);

  const notModeratable = setup({ mentions: true });
  const third = scene({ mentions: 6, moderatable: false });
  await enforceAutomod(notModeratable.context, third.message);
  expect(third.calls.timeouts).toEqual([]);
  expect(third.calls.deleted).toBe(1);
});

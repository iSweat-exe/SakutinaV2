import { Collection, PermissionFlagsBits } from "discord.js";
import { expect, test } from "bun:test";

import { banCommand } from "@/discord/commands/moderation/ban.ts";
import { kickCommand } from "@/discord/commands/moderation/kick.ts";
import { purgeCommand } from "@/discord/commands/moderation/purge.ts";
import { timeoutCommand } from "@/discord/commands/moderation/timeout.ts";
import { unbanCommand } from "@/discord/commands/moderation/unban.ts";
import { untimeoutCommand } from "@/discord/commands/moderation/untimeout.ts";
import { unwarnCommand } from "@/discord/commands/moderation/unwarn.ts";
import { warnCommand } from "@/discord/commands/moderation/warn.ts";
import { warningsCommand } from "@/discord/commands/moderation/warnings.ts";
import { messages } from "@/discord/messages.ts";
import {
  GUILD,
  ME,
  OTHER,
  commandInteraction,
  createContext,
  isEphemeral,
  user,
  type FakeUser,
} from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

const text = messages.moderation;

type MemberOptions = {
  position?: number;
  admin?: boolean;
  moderate?: boolean;
  kickable?: boolean;
  bannable?: boolean;
  moderatable?: boolean;
  failing?: boolean;
};

/** Un membre factice : seuls les champs que le bot lit, et des actions qui s'enregistrent. */
function member(id: string, options: MemberOptions = {}) {
  const calls: string[] = [];
  const act = (name: string) => async (...args: unknown[]) => {
    if (options.failing) throw new Error("Missing Permissions");
    calls.push(`${name}:${args.map(String).join("|")}`);
  };

  return {
    id,
    calls,
    guild: { ownerId: "propriétaire" },
    roles: { highest: { position: options.position ?? 1 }, cache: new Collection<string, unknown>() },
    permissions: {
      has: (flag: bigint) =>
        (flag === PermissionFlagsBits.Administrator && options.admin === true) ||
        (flag === PermissionFlagsBits.ModerateMembers && options.moderate === true),
    },
    kickable: options.kickable ?? true,
    bannable: options.bannable ?? true,
    moderatable: options.moderatable ?? true,
    timeout: act("timeout"),
    kick: act("kick"),
  };
}

function setup(members: Record<string, ReturnType<typeof member>>, options: { failing?: boolean } = {}) {
  const guildCalls: string[] = [];
  const guild = {
    id: GUILD,
    name: "Uwu",
    ownerId: "propriétaire",
    members: {
      fetch: async (id: string) => {
        const found = members[id];

        if (!found) throw new Error("Unknown Member");

        return found;
      },
      ban: async (...args: unknown[]) => {
        if (options.failing) throw new Error("Missing Permissions");
        guildCalls.push(`ban:${(args[0] as FakeUser).id}|${JSON.stringify(args[1])}`);
      },
    },
    bans: {
      remove: async (id: string, reason: string) => {
        if (options.failing) throw new Error("Unknown Ban");
        guildCalls.push(`unban:${id}|${reason}`);
      },
    },
  };

  return { guild, guildCalls };
}

/** Un utilisateur dont les messages privés s'enregistrent. */
function reachable(id: string, name: string) {
  const dms: unknown[] = [];

  return {
    dms,
    user: {
      ...user(id, name),
      createDM: async () => ({ send: async (payload: unknown) => void dms.push(payload) }),
    } as FakeUser,
  };
}

const moderator = { role: "moderator" } as const;
const admin = { role: "admin" } as const;

test("/mod warn enregistre l'avertissement, prévient le membre et journalise", async () => {
  const { context, auditLog, moderationService } = createContext();
  const target = reachable(OTHER, "Autre");
  const { guild } = setup({ [ME]: member(ME, { position: 10, moderate: true }), [OTHER]: member(OTHER, { position: 1 }) });
  const command = commandInteraction({ users: { member: target.user }, strings: { reason: "spam" }, guild });

  await warnCommand.execute(command.fake, context, moderator);

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(textOf(command.replies[0])).toContain(text.warn.title);
  expect(textOf(command.replies[0])).toContain("1 au total");
  expect((await moderationService.warnings(GUILD, OTHER)).latest[0]).toMatchObject({ reason: "spam", moderatorId: ME });
  expect(target.dms).toHaveLength(1);
  expect(JSON.stringify(target.dms[0])).toContain("spam");

  const [event] = await auditLog.listForGuild(GUILD, 5);

  expect(event).toMatchObject({
    action: "moderation.warn",
    actorId: ME,
    targetId: OTHER,
    metadata: { reason: "spam", result: "ok" },
  });
});

test("des messages privés fermés ne bloquent pas la sanction", async () => {
  const { context, moderationService } = createContext();
  const closed = {
    ...user(OTHER, "Autre"),
    createDM: async () => {
      throw new Error("Cannot send messages to this user");
    },
  } as FakeUser;
  const { guild } = setup({ [ME]: member(ME, { position: 10 }), [OTHER]: member(OTHER) });
  const command = commandInteraction({ users: { member: closed }, strings: { reason: "x" }, guild });

  await warnCommand.execute(command.fake, context, moderator);

  expect(textOf(command.replies[0])).toContain(text.warn.title);
  expect((await moderationService.warnings(GUILD, OTHER)).total).toBe(1);
});

test("un modérateur ne peut pas sanctionner un administrateur ni un membre plus haut placé", async () => {
  const { context, auditLog, moderationService } = createContext();
  const cases: [string, MemberOptions, string][] = [
    ["rôle du bot supérieur", { position: 1, admin: true }, text.refusals.role],
    ["position Discord supérieure", { position: 50 }, text.refusals.position],
    ["le bot ne peut pas agir", { position: 1, kickable: false }, text["refusals"]["bot-position"]],
  ];

  for (const [, options, expected] of cases) {
    const { guild } = setup({ [ME]: member(ME, { position: 10, moderate: true }), [OTHER]: member(OTHER, options) });
    const command = commandInteraction({ users: { member: user(OTHER, "Autre") }, strings: { reason: "x" }, guild });

    await kickCommand.execute(command.fake, context, moderator);

    expect(isEphemeral(command.replies[0])).toBe(true);
    expect(textOf(command.replies[0])).toContain(expected);
  }

  const events = await auditLog.listForGuild(GUILD, 10);

  expect(events.map((event) => event.metadata.result).sort()).toEqual([
    "refused:bot-position",
    "refused:position",
    "refused:role",
  ]);
  expect((await moderationService.warnings(GUILD, OTHER)).total).toBe(0);
});

test("on ne peut pas se sanctionner soi-même ni sanctionner le propriétaire", async () => {
  const { context } = createContext();
  const { guild } = setup({
    [ME]: member(ME, { position: 10 }),
    propriétaire: member("propriétaire", { position: 1 }),
  });

  const self = commandInteraction({ users: { member: user(ME, "Moi") }, strings: { reason: "x" }, guild });
  await warnCommand.execute(self.fake, context, moderator);
  expect(textOf(self.replies[0])).toContain(text.refusals.self);

  const owner = commandInteraction({ users: { member: user("propriétaire", "Boss") }, strings: { reason: "x" }, guild });
  await kickCommand.execute(owner.fake, context, { role: "admin" });
  expect(textOf(owner.replies[0])).toContain(text.refusals.owner);
});

test("/mod kick expulse après avoir prévenu le membre", async () => {
  const { context, auditLog } = createContext();
  const target = reachable(OTHER, "Autre");
  const victim = member(OTHER, { position: 1 });
  const { guild } = setup({ [ME]: member(ME, { position: 10 }), [OTHER]: victim });
  const command = commandInteraction({ users: { member: target.user }, strings: { reason: "insultes" }, guild });

  await kickCommand.execute(command.fake, context, moderator);

  expect(victim.calls).toEqual(["kick:moi : insultes"]);
  expect(target.dms).toHaveLength(1);
  expect(textOf(command.replies[0])).toContain(text.kick.title);
  expect((await auditLog.listForGuild(GUILD, 1))[0]).toMatchObject({
    action: "moderation.kick",
    metadata: { result: "ok" },
  });
});

test("un échec de Discord est journalisé et annoncé sans rien prétendre avoir fait", async () => {
  const { context, auditLog } = createContext();
  const { guild } = setup({
    [ME]: member(ME, { position: 10 }),
    [OTHER]: member(OTHER, { position: 1, failing: true }),
  });
  const command = commandInteraction({ users: { member: user(OTHER, "Autre") }, strings: { reason: "x" }, guild });

  await kickCommand.execute(command.fake, context, moderator);

  expect(textOf(command.replies[0])).toContain(text.failed);
  expect(textOf(command.replies[0])).not.toContain(text.kick.title);
  expect((await auditLog.listForGuild(GUILD, 1))[0]?.metadata.result).toBe("failed");
});

test("/mod timeout applique la durée lue, refuse une durée illisible et journalise la durée", async () => {
  const { context, auditLog, sanctionStore } = createContext();
  const victim = member(OTHER, { position: 1 });
  const { guild } = setup({ [ME]: member(ME, { position: 10 }), [OTHER]: victim });

  const bad = commandInteraction({
    users: { member: user(OTHER, "Autre") },
    strings: { duration: "bientôt", reason: "x" },
    guild,
  });
  await timeoutCommand.execute(bad.fake, context, moderator);
  expect(textOf(bad.replies[0])).toContain(text.timeout.invalidTitle);
  expect(victim.calls).toEqual([]);

  const good = commandInteraction({
    users: { member: user(OTHER, "Autre") },
    strings: { duration: "2h", reason: "calme-toi" },
    guild,
  });
  await timeoutCommand.execute(good.fake, context, moderator);

  expect(sanctionStore.sanctions).toHaveLength(1);
  expect(sanctionStore.sanctions[0]).toMatchObject({ kind: "mute", memberId: OTHER, moderatorId: ME, reason: "calme-toi" });
  expect(sanctionStore.sanctions[0]!.endsAt!.getTime() - sanctionStore.sanctions[0]!.createdAt.getTime()).toBe(2 * 3_600_000);
  expect(victim.calls).toEqual([`timeout:${2 * 3_600_000}|moi : calme-toi`]);
  expect(textOf(good.replies[0])).toContain(text.timeout.title);
  expect((await auditLog.listForGuild(GUILD, 1))[0]?.metadata).toMatchObject({ durationMinutes: 120, result: "ok" });
});

test("/mod untimeout lève le timeout", async () => {
  const { context, sanctionStore } = createContext();
  const victim = member(OTHER, { position: 1 });
  const { guild } = setup({ [ME]: member(ME, { position: 10 }), [OTHER]: victim });
  const command = commandInteraction({ users: { member: user(OTHER, "Autre") }, guild });

  await context.sanctionService.recordMute(GUILD, OTHER, "autre", "x", 3_600_000);
  await untimeoutCommand.execute(command.fake, context, moderator);

  expect(victim.calls).toEqual(["timeout:null|moi : —"]);
  expect(await sanctionStore.hasActive(GUILD, OTHER, "mute", new Date())).toBe(false);
  expect(textOf(command.replies[0])).toContain(text.untimeout.title);
});

test("/mod ban bannit un membre présent comme un utilisateur absent, avec les jours de messages", async () => {
  const { context, auditLog, sanctionStore } = createContext();
  const { guild, guildCalls } = setup({ [ME]: member(ME, { position: 10 }), [OTHER]: member(OTHER, { position: 1 }) });

  const present = commandInteraction({
    users: { member: user(OTHER, "Autre") },
    strings: { reason: "raid" },
    integers: { delete_days: 2 },
    guild,
  });
  await banCommand.execute(present.fake, context, admin);

  const absent = commandInteraction({ users: { member: user("333", "Parti") }, strings: { reason: "revenu" }, guild });
  await banCommand.execute(absent.fake, context, admin);

  expect(sanctionStore.sanctions.map((sanction) => [sanction.kind, sanction.memberId, sanction.endsAt])).toEqual([
    ["ban", OTHER, null],
    ["ban", "333", null],
  ]);
  expect(guildCalls[0]).toContain(`ban:${OTHER}`);
  expect(guildCalls[0]).toContain(`"deleteMessageSeconds":${2 * 86_400}`);
  expect(guildCalls[1]).toContain("ban:333");
  expect(textOf(absent.replies[0])).toContain(text.ban.title);
  expect((await auditLog.listForGuild(GUILD, 2)).map((event) => event.metadata.result)).toEqual(["ok", "ok"]);
});

test("/mod ban refuse un membre non bannable par le bot", async () => {
  const { context } = createContext();
  const { guild, guildCalls } = setup({
    [ME]: member(ME, { position: 10 }),
    [OTHER]: member(OTHER, { position: 1, bannable: false }),
  });
  const command = commandInteraction({ users: { member: user(OTHER, "Autre") }, strings: { reason: "x" }, guild });

  await banCommand.execute(command.fake, context, admin);

  expect(textOf(command.replies[0])).toContain(text["refusals"]["bot-position"]);
  expect(guildCalls).toEqual([]);
});

test("/mod unban lève le bannissement par identifiant et refuse un identifiant invalide", async () => {
  const { context, auditLog } = createContext();
  const { guild, guildCalls } = setup({});

  const bad = commandInteraction({ strings: { user_id: "pas un id" }, guild });
  await unbanCommand.execute(bad.fake, context, admin);
  expect(textOf(bad.replies[0])).toContain(text.unban.invalidTitle);

  const good = commandInteraction({ strings: { user_id: "123456789012345678", reason: "erreur" }, guild });
  await context.sanctionService.recordBan(GUILD, "123456789012345678", "autre", "x");
  await unbanCommand.execute(good.fake, context, admin);

  expect(await context.sanctionService.clear("ban", GUILD, "123456789012345678", null)).toBe(0);
  expect(guildCalls).toEqual(["unban:123456789012345678|moi : erreur"]);
  expect(textOf(good.replies[0])).toContain(text.unban.title);
  expect((await auditLog.listForGuild(GUILD, 1))[0]).toMatchObject({
    action: "moderation.unban",
    targetId: "123456789012345678",
  });
});

test("/mod warnings liste, /mod unwarn retire par numéro", async () => {
  const { context, moderationService, auditLog } = createContext();
  const first = await moderationService.warn(GUILD, OTHER, ME, "premier");
  await moderationService.warn(GUILD, OTHER, ME, "**second**");

  const list = commandInteraction({ users: { member: user(OTHER, "Autre") } });
  await warningsCommand.execute(list.fake, context, moderator);
  const listed = textOf(list.replies[0]);

  expect(listed).toContain("premier");
  expect(listed).toContain("\\*\\*second\\*\\*");
  expect(listed).toContain("2 au total");

  const remove = commandInteraction({ integers: { id: first.id } });
  await unwarnCommand.execute(remove.fake, context, admin);
  expect(textOf(remove.replies[0])).toContain(text.unwarn.title);
  expect((await moderationService.warnings(GUILD, OTHER)).total).toBe(1);

  const missing = commandInteraction({ integers: { id: 9999 } });
  await unwarnCommand.execute(missing.fake, context, admin);
  expect(textOf(missing.replies[0])).toContain(text.unwarn.missingTitle);
  expect((await auditLog.listForGuild(GUILD, 2)).map((event) => event.metadata.result)).toEqual(["refused:missing", "ok"]);

  const empty = commandInteraction({ users: { member: user("inconnu", "Propre") } });
  await warningsCommand.execute(empty.fake, context, moderator);
  expect(textOf(empty.replies[0])).toContain(text.warnings.empty);
});

function channelWith(messagesList: { id: string; authorId: string; ageDays: number }[]) {
  const deleted: string[][] = [];
  const now = Date.now();
  const collection = new Collection(
    messagesList.map((message) => [
      message.id,
      { id: message.id, author: { id: message.authorId }, createdTimestamp: now - message.ageDays * 86_400_000 },
    ]),
  );

  return {
    deleted,
    channel: {
      id: "salon",
      isDMBased: () => false,
      messages: { fetch: async () => collection },
      bulkDelete: async (list: { id: string }[]) => {
        deleted.push(list.map((message) => message.id));

        return { size: list.length };
      },
    },
  };
}

test("/mod purge supprime les derniers messages récents, éventuellement ceux d'un membre", async () => {
  const { context, auditLog } = createContext();
  const { channel, deleted } = channelWith([
    { id: "1", authorId: OTHER, ageDays: 0 },
    { id: "2", authorId: ME, ageDays: 1 },
    { id: "3", authorId: OTHER, ageDays: 2 },
    { id: "4", authorId: OTHER, ageDays: 20 },
  ]);

  const all = commandInteraction({ integers: { count: 2 }, channel });
  await purgeCommand.execute(all.fake, context, moderator);
  expect(deleted[0]).toEqual(["1", "2"]);
  expect(textOf(all.replies[0])).toContain("**2** messages");

  const mine = commandInteraction({ integers: { count: 10 }, users: { member: user(OTHER, "Autre") }, channel });
  await purgeCommand.execute(mine.fake, context, moderator);
  // Le message de 20 jours est hors de portée de la suppression en masse.
  expect(deleted[1]).toEqual(["1", "3"]);

  const [event] = await auditLog.listForGuild(GUILD, 1);

  expect(event).toMatchObject({ action: "moderation.purge", targetId: OTHER });
  expect(event?.metadata).toMatchObject({ channelId: "salon", requested: 10, deleted: 2, result: "ok" });
});

test("/mod purge le dit quand il n'y a rien à supprimer ou que le salon ne le permet pas", async () => {
  const { context } = createContext();
  const { channel, deleted } = channelWith([{ id: "1", authorId: OTHER, ageDays: 30 }]);

  const none = commandInteraction({ integers: { count: 5 }, channel });
  await purgeCommand.execute(none.fake, context, moderator);
  expect(textOf(none.replies[0])).toContain(text.purge.none);
  expect(deleted).toEqual([]);

  const dm = commandInteraction({ integers: { count: 5 }, channel: { isDMBased: () => true } });
  await purgeCommand.execute(dm.fake, context, moderator);
  expect(textOf(dm.replies[0])).toContain(text.purge.unavailableTitle);
});

import { ActivityType, Collection, MessageType } from "discord.js";
import { expect, test } from "bun:test";

import { guildMemberUpdate } from "@/discord/events/guild-member-update.ts";
import { messageCreate } from "@/discord/events/message-create.ts";
import { messageReactionAdd } from "@/discord/events/message-reaction-add.ts";
import { presenceUpdate } from "@/discord/events/presence-update.ts";
import { userUpdate } from "@/discord/events/user-update.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { observePresence } from "@/discord/presence.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { PhaethonTracker } from "@/domain/phaethon/phaethon-tracker.ts";
import { PresenceSessions } from "@/domain/phaethon/presence-sessions.ts";

const GUILD = "guild";

function context(trackPresence = true) {
  const activityTracker = new ActivityTracker();
  const phaethonTracker = new PhaethonTracker();
  const observed: unknown[] = [];
  const presenceSessions = new PresenceSessions({ status: () => undefined, game: () => undefined });
  const original = presenceSessions.observe.bind(presenceSessions);
  presenceSessions.observe = (...args) => {
    observed.push(args);
    original(...args);
  };

  return {
    observed,
    phaethonTracker,
    activityTracker,
    context: {
      config: { legacyGuildId: null, trackPresence },
      guildSync: { schedule: () => undefined },
      memberService: { setIdentity: async () => undefined },
      activityTracker,
      phaethonTracker,
      presenceSessions,
    } as unknown as HandlerContext,
  };
}

const person = (id: string, bot = false) => ({ id, bot });
const at = new Date("2026-11-05T23:30:00Z");

function message(options: {
  author?: ReturnType<typeof person>;
  type?: MessageType;
  repliedUser?: ReturnType<typeof person> | null;
  mentions?: ReturnType<typeof person>[];
  guildId?: string | null;
}) {
  const mentions = new Map((options.mentions ?? []).map((mention) => [mention.id, mention]));

  return {
    author: options.author ?? person("a"),
    guildId: options.guildId === undefined ? GUILD : options.guildId,
    inGuild: () => options.guildId !== null,
    channelId: "c",
    createdAt: at,
    content: "texte secret qui ne doit jamais être conservé",
    type: options.type ?? MessageType.Default,
    attachments: { size: 0 },
    reference: null,
    channel: { messages: { cache: new Map() } },
    mentions: {
      repliedUser: options.repliedUser ?? null,
      users: { size: mentions.size, values: () => mentions.values() },
    },
  } as never;
}

test("un message enregistre l'heure, la réponse et les mentions, jamais le contenu", () => {
  const { context: ctx, phaethonTracker } = context();

  messageCreate.execute(
    ctx,
    message({
      type: MessageType.Reply,
      repliedUser: person("b"),
      mentions: [person("b"), person("c"), person("robot", true), person("a")],
    }),
  );

  const batch = phaethonTracker.drain();

  expect(batch.hours).toEqual([{ guildId: GUILD, memberId: "a", day: "2026-11-05", hour: 23, messages: 1 }]);
  expect(batch.edges.map((edge) => `${edge.targetId}:${edge.replies}/${edge.mentions}`).sort()).toEqual([
    "b:1/0",
    "c:0/1",
  ]);
  expect(JSON.stringify(batch)).not.toContain("secret");
});

test("les bots et les messages privés sont ignorés", () => {
  const { context: ctx, phaethonTracker } = context();

  messageCreate.execute(ctx, message({ author: person("robot", true) }));
  messageCreate.execute(ctx, message({ guildId: null }));

  expect(phaethonTracker.drain().hours).toEqual([]);
});

test("une réaction relie le réacteur à l'auteur du message", async () => {
  const { context: ctx, phaethonTracker } = context();

  await messageReactionAdd.execute(
    ctx,
    { message: { guildId: GUILD, partial: false, author: person("auteur") } } as never,
    person("lecteur") as never,
    {} as never,
  );
  await messageReactionAdd.execute(
    ctx,
    { message: { guildId: GUILD, partial: false, author: person("lecteur") } } as never,
    person("lecteur") as never,
    {} as never,
  );

  const { edges } = phaethonTracker.drain();

  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ memberId: "lecteur", targetId: "auteur", reactions: 1 });
});

function member(options: {
  nickname?: string | null;
  avatar?: string | null;
  roles?: string[];
  premium?: number | null;
  timeout?: number | null;
  partial?: boolean;
  bot?: boolean;
}) {
  return {
    id: "m",
    partial: options.partial ?? false,
    guild: { id: GUILD },
    user: { bot: options.bot ?? false },
    nickname: options.nickname ?? null,
    avatar: options.avatar ?? null,
    premiumSinceTimestamp: options.premium ?? null,
    communicationDisabledUntilTimestamp: options.timeout ?? null,
    roles: { cache: new Collection((options.roles ?? []).map((id) => [id, { id }] as const)) },
  } as never;
}

test("un changement de pseudo, d'avatar, de rôles, de boost et de timeout est daté", () => {
  const { context: ctx, phaethonTracker } = context();

  guildMemberUpdate.execute(
    ctx,
    member({ nickname: "Avant", roles: ["r1", "r2"] }),
    member({ nickname: "Après", avatar: "hash", roles: ["r2", "r3"], premium: 1_700_000_000_000, timeout: 1_800_000_000_000 }),
  );

  const kinds = phaethonTracker.drain().identity.map((event) => `${event.kind}:${event.oldValue}>${event.newValue}`);

  expect(kinds).toContain("nickname:Avant>Après");
  expect(kinds).toContain("avatar:null>hash");
  expect(kinds).toContain("roles:null>+r3,-r1");
  expect(kinds.some((entry) => entry.startsWith("boost:null>2023"))).toBe(true);
  expect(kinds.some((entry) => entry.startsWith("timeout:null>2027"))).toBe(true);
});

test("aucun changement, une ancienne fiche partielle ou un bot ne produisent rien", () => {
  const { context: ctx, phaethonTracker } = context();

  guildMemberUpdate.execute(ctx, member({ nickname: "Pareil" }), member({ nickname: "Pareil" }));
  guildMemberUpdate.execute(ctx, member({ partial: true }), member({ nickname: "Nouveau" }));
  guildMemberUpdate.execute(ctx, member({ bot: true }), member({ bot: true, nickname: "Nouveau" }));

  expect(phaethonTracker.drain().identity).toEqual([]);
});

test("un changement de compte n'est suivi que pour les membres du serveur", () => {
  const { context: ctx, phaethonTracker } = context();
  const userOf = (overrides: Record<string, unknown>) =>
    ({
      id: "u",
      bot: false,
      partial: false,
      username: "ancien",
      globalName: "Nom",
      avatar: "a1",
      client: { guilds: { cache: new Map([[GUILD, { id: GUILD, members: { cache: new Map([["u", { displayName: "Nom", user: { avatar: null, username: "nouveau" }, roles: { cache: new Map() }, guild: { id: GUILD } }]]) } }]]) } },
      ...overrides,
    }) as never;

  userUpdate.execute(ctx, userOf({}), userOf({ username: "nouveau", globalName: "Autre", avatar: "a2" }));
  userUpdate.execute(
    ctx,
    userOf({ id: "inconnu" }),
    userOf({ id: "inconnu", username: "nouveau" }),
  );

  expect(phaethonTracker.drain().identity.map((event) => event.kind).sort()).toEqual([
    "avatar",
    "display-name",
    "username",
  ]);
});

test("la présence n'est suivie que si l'option est active", () => {
  const enabled = context(true);
  const disabled = context(false);
  const presence = {
    guild: { id: GUILD },
    userId: "u",
    user: { bot: false },
    status: "online",
    activities: [],
  } as never;

  presenceUpdate.execute(enabled.context, null as never, presence);
  presenceUpdate.execute(disabled.context, null as never, presence);

  expect(enabled.observed).toHaveLength(1);
  expect(disabled.observed).toHaveLength(0);
});

test("seuls le statut et le nom des activités sont retenus, pas le statut personnalisé ni les détails", () => {
  const observed = observePresence({
    status: "dnd",
    activities: [
      { type: ActivityType.Playing, name: "Celeste", details: "Chapitre 3", state: "secret" },
      { type: ActivityType.Custom, name: "Custom Status", state: "mon texte libre" },
      { type: ActivityType.Listening, name: "Spotify", details: "Titre du morceau" },
    ],
  } as never);

  expect(observed).toEqual({
    status: "dnd",
    games: [
      { name: "Celeste", kind: "playing" },
      { name: "Spotify", kind: "listening" },
    ],
  });
  expect(JSON.stringify(observed)).not.toContain("secret");
  expect(observePresence({ status: "invisible", activities: [] } as never).status).toBe("offline");
  expect(observePresence(null).status).toBe("offline");
});

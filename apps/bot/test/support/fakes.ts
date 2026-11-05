import type {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryWarningStore } from "@/database/in-memory/memory-warning-store.ts";
import { ModerationService } from "@/domain/moderation/moderation-service.ts";
import { MemoryAuditLog } from "@/database/in-memory/memory-audit-log.ts";
import { MemoryPhaethonStore } from "@/database/in-memory/memory-phaethon-store.ts";
import { MemoryEconomyStore } from "@/database/in-memory/memory-economy-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import { MemoryGuildStore } from "@/database/in-memory/memory-guild-store.ts";
import { CasinoService } from "@/domain/casino/casino-service.ts";
import { GuildService } from "@/domain/guilds/guild-service.ts";
import { MemorySanctionStore } from "@/database/in-memory/memory-sanction-store.ts";
import { SpamWindow } from "@/domain/moderation/automod.ts";
import { SanctionService } from "@/domain/moderation/sanction-service.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { ActivityService } from "@/domain/activity/activity-service.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";
import { PhaethonService } from "@/domain/phaethon/phaethon-service.ts";
import { PhaethonTracker } from "@/domain/phaethon/phaethon-tracker.ts";
import { MemberService } from "@/domain/members/member-service.ts";

export const GUILD = "guild";
export const ME = "111";
export const OTHER = "222";

export type FakeUser = {
  id: string;
  displayName: string;
  username: string;
  createdAt: Date;
  bot: boolean;
  displayAvatarURL: () => string;
};

export const user = (id: string, displayName: string): FakeUser => ({
  id,
  displayName,
  username: displayName.toLowerCase(),
  createdAt: new Date("2024-01-01T00:00:00Z"),
  bot: false,
  displayAvatarURL: () => `https://cdn.test/${id}.png`,
});

/** Contexte complet avec des stockages en mémoire : ME a 1 message, OTHER en a 2. */
export function createContext() {
  const tracker = new ActivityTracker();
  const members = new MemoryMemberStore();
  const economyService = new EconomyService(new MemoryEconomyStore());
  const activityService = new ActivityService(tracker, new MemoryActivityStore(), members);
  const memberService = new MemberService(members);
  const phaethonTracker = new PhaethonTracker();
  const phaethonService = new PhaethonService(
    phaethonTracker,
    new MemoryPhaethonStore(),
    activityService,
    memberService,
  );
  const auditLog = new MemoryAuditLog();
  const moderationService = new ModerationService(new MemoryWarningStore());
  const guildStore = new MemoryGuildStore();
  /** Le tirage des jeux : les tests fixent `rng.next` pour choisir l'issue. */
  const rng = { next: () => 0.5 };
  const guildService = new GuildService(guildStore);
  const casinoService = new CasinoService(economyService, () => rng.next(), async (guildId) => (await guildService.settings(guildId)).casino);
  const sanctionStore = new MemorySanctionStore();
  const context = {
    config: { legacyGuildId: null, adminRoleIds: [], moderatorRoleIds: [] },
    guildService,
    sanctionService: new SanctionService(sanctionStore),
    casinoService,
    spamWindow: new SpamWindow(),
    activityTracker: tracker,
    activityService,
    memberService,
    economyService,
    phaethonTracker,
    phaethonService,
    moderationService,
    auditLog,
  } as unknown as HandlerContext;

  const facts = { characters: 5, isReply: false, attachments: 0, mentions: 0 };
  tracker.recordMessage(GUILD, ME, "c", new Date(), facts);
  tracker.recordMessage(GUILD, OTHER, "c", new Date(), facts);
  tracker.recordMessage(GUILD, OTHER, "c", new Date(), facts);

  return { context, rng, guildStore, sanctionStore, tracker, economyService, phaethonTracker, phaethonService, moderationService, auditLog };
}

export type Sent = { components?: unknown[]; flags?: number; files?: unknown[] };

const EPHEMERAL = 64;

export const isEphemeral = (sent: Sent | undefined) => ((sent?.flags ?? 0) & EPHEMERAL) !== 0;

type Calls = { replies: Sent[]; updates: Sent[]; modals: unknown[]; edits: Sent[] };

function base(options: { id?: string; as?: FakeUser }) {
  const calls: Calls = { replies: [], updates: [], modals: [], edits: [] };
  const common = {
    id: options.id ?? "interaction-1",
    deferred: false,
    replied: false,
    user: options.as ?? user(ME, "Moi"),
    guildId: GUILD,
    client: {
      users: { fetch: async (id: string) => user(id, `Membre ${id}`) },
      guilds: { cache: new Map([[GUILD, { id: GUILD }]]) },
    },
    reply: async (payload: Sent) => {
      calls.replies.push(payload);
    },
    update: async (payload: Sent) => {
      calls.updates.push(payload);
    },
    editReply: async (payload: Sent) => {
      calls.edits.push(payload);
    },
    showModal: async (modal: unknown) => {
      calls.modals.push(modal);
    },
  };

  return { calls, common };
}

export function commandInteraction(options: {
  strings?: Record<string, string>;
  integers?: Record<string, number>;
  booleans?: Record<string, boolean>;
  users?: Record<string, FakeUser>;
  id?: string;
  as?: FakeUser;
  guild?: unknown;
  channel?: unknown;
}) {
  const { calls, common } = base(options);
  const fake = {
    ...common,
    guild: options.guild,
    guildId: GUILD,
    channel: options.channel,
    client: { ...common.client, user: { id: "bot" } },
    options: {
      getString: (name: string) => options.strings?.[name] ?? null,
      getInteger: (name: string, required?: boolean) => {
        const value = options.integers?.[name] ?? null;

        if (value === null && required) throw new Error(`missing ${name}`);

        return value;
      },
      getBoolean: (name: string) => options.booleans?.[name] ?? null,
      getUser: (name: string) => options.users?.[name] ?? null,
    },
  } as unknown as ChatInputCommandInteraction;

  return { fake, ...calls, calls };
}

export function buttonInteraction(options: { id?: string; as?: FakeUser; ephemeralMessage?: boolean }) {
  const { calls, common } = base(options);
  const fake = {
    ...common,
    isButton: () => true,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    message: { flags: { has: () => options.ephemeralMessage ?? true } },
  } as unknown as MessageComponentInteraction;

  return { fake, calls };
}

export function selectInteraction(options: {
  values: string[];
  id?: string;
  as?: FakeUser;
  ephemeralMessage?: boolean;
}) {
  const { calls, common } = base(options);
  const fake = {
    ...common,
    values: options.values,
    isButton: () => false,
    isStringSelectMenu: () => true,
    isModalSubmit: () => false,
    message: { flags: { has: () => options.ephemeralMessage ?? true } },
  } as unknown as MessageComponentInteraction;

  return { fake, calls };
}

export function modalInteraction(options: { operation: string; amount: string; id?: string; as?: FakeUser }) {
  const { calls, common } = base(options);
  const fake = {
    ...common,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => true,
    isFromMessage: () => true,
    fields: {
      getStringSelectValues: () => [options.operation],
      getTextInputValue: () => options.amount,
    },
  } as unknown as ModalSubmitInteraction;

  return { fake, calls };
}

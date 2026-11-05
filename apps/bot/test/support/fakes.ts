import type {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryEconomyStore } from "@/database/in-memory/memory-economy-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { ActivityService } from "@/domain/activity/activity-service.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";
import { MemberService } from "@/domain/members/member-service.ts";

export const GUILD = "guild";
export const ME = "111";
export const OTHER = "222";

export type FakeUser = {
  id: string;
  displayName: string;
  displayAvatarURL: () => string;
};

export const user = (id: string, displayName: string): FakeUser => ({
  id,
  displayName,
  displayAvatarURL: () => `https://cdn.test/${id}.png`,
});

/** Contexte complet avec des stockages en mémoire : ME a 1 message, OTHER en a 2. */
export function createContext() {
  const tracker = new ActivityTracker();
  const members = new MemoryMemberStore();
  const economyService = new EconomyService(new MemoryEconomyStore());
  const context = {
    config: { primaryGuildId: GUILD },
    activityTracker: tracker,
    activityService: new ActivityService(tracker, new MemoryActivityStore(), members),
    memberService: new MemberService(members),
    economyService,
  } as unknown as HandlerContext;

  const facts = { characters: 5, isReply: false, attachments: 0, mentions: 0 };
  tracker.recordMessage(GUILD, ME, "c", new Date(), facts);
  tracker.recordMessage(GUILD, OTHER, "c", new Date(), facts);
  tracker.recordMessage(GUILD, OTHER, "c", new Date(), facts);

  return { context, tracker, economyService };
}

export type Sent = { components?: unknown[]; flags?: number; files?: unknown[] };

const EPHEMERAL = 64;

export const isEphemeral = (sent: Sent | undefined) => ((sent?.flags ?? 0) & EPHEMERAL) !== 0;

type Calls = { replies: Sent[]; updates: Sent[]; modals: unknown[] };

function base(options: { id?: string; as?: FakeUser }) {
  const calls: Calls = { replies: [], updates: [], modals: [] };
  const common = {
    id: options.id ?? "interaction-1",
    deferred: false,
    replied: false,
    user: options.as ?? user(ME, "Moi"),
    client: { users: { fetch: async (id: string) => user(id, `Membre ${id}`) } },
    reply: async (payload: Sent) => {
      calls.replies.push(payload);
    },
    update: async (payload: Sent) => {
      calls.updates.push(payload);
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
  users?: Record<string, FakeUser>;
  id?: string;
}) {
  const { calls, common } = base(options);
  const fake = {
    ...common,
    options: {
      getString: (name: string) => options.strings?.[name] ?? null,
      getInteger: (name: string) => options.integers?.[name] ?? null,
      getBoolean: () => null,
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

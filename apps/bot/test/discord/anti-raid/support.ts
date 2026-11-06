import { ChannelType } from "discord.js";

import { MemoryAuditLog } from "@/database/in-memory/memory-audit-log.ts";
import { MemoryRaidStore } from "@/database/in-memory/memory-raid-store.ts";
import { MemorySanctionStore } from "@/database/in-memory/memory-sanction-store.ts";
import { createRaidGuard } from "@/discord/anti-raid/raid-guard.ts";
import { DEFAULT_ANTI_RAID, type AntiRaidSettings } from "@/domain/anti-raid/anti-raid-rules.ts";
import { AntiRaidService } from "@/domain/anti-raid/anti-raid-service.ts";
import { SanctionService } from "@/domain/moderation/sanction-service.ts";

export const GUILD_ID = "guild-1";
export const SEND = 1n << 11n;
export const VIEW = 1n << 10n;

type FakeOverwrite = { allow: { bitfield: bigint }; deny: { bitfield: bigint } };

export type FakeChannel = {
  id: string;
  type: ChannelType;
  permissionOverwrites: { cache: Map<string, FakeOverwrite> };
  permissionsFor: () => { has: () => boolean };
};

/** Un salon dont @everyone a cette surcharge (`null` : aucune) ; `manageable: false` : le bot n'y gère pas les permissions. */
export function channel(id: string, everyone: { allow: bigint; deny: bigint } | null, manageable = true, type = ChannelType.GuildText): FakeChannel {
  const cache = new Map<string, FakeOverwrite>();

  if (everyone) {
    cache.set(GUILD_ID, { allow: { bitfield: everyone.allow }, deny: { bitfield: everyone.deny } });
  }

  return { id, type, permissionOverwrites: { cache }, permissionsFor: () => ({ has: () => manageable }) };
}

export type FakeMember = ReturnType<typeof member>;

/** Un membre ; `fail` : Discord refuse d'agir sur lui (hiérarchie). */
export function member(guild: FakeGuild, id: string, options: { bot?: boolean; admin?: boolean; fail?: boolean } = {}) {
  const fake = {
    id,
    guild,
    user: { bot: options.bot ?? false },
    permissions: { has: () => options.admin ?? false },
    timeouts: [] as number[],
    kicked: false,
    timeout: async (ms: number) => {
      if (options.fail) throw new Error("Missing Permissions");
      fake.timeouts.push(ms);
    },
    kick: async () => {
      if (options.fail) throw new Error("Missing Permissions");
      fake.kicked = true;
    },
  };
  guild.memberList.set(id, fake);
  return fake;
}

export type FakeGuild = ReturnType<typeof fakeGuild>;

/** Un serveur : ses salons, ses membres, et une API REST qui applique les surcharges comme le ferait la passerelle. */
export function fakeGuild(channels: FakeChannel[], options: { verificationLevel?: number; manageGuild?: boolean } = {}) {
  const calls: string[] = [];
  const memberList = new Map<string, unknown>();
  const banned: string[] = [];
  const guild = {
    id: GUILD_ID,
    ownerId: "owner",
    verificationLevel: options.verificationLevel ?? 1,
    calls,
    banned,
    memberList,
    channels: { cache: new Map(channels.map((c) => [c.id, c])) },
    members: {
      me: { permissions: { has: () => options.manageGuild ?? true } },
      fetch: async (id: string) => {
        const found = memberList.get(id);
        if (!found) throw new Error("Unknown Member");
        return found;
      },
      ban: async (id: string) => {
        banned.push(id);
      },
    },
    setVerificationLevel: async (level: number) => {
      calls.push(`verification:${level}`);
      guild.verificationLevel = level;
    },
    client: {
      rest: {
        put: async (route: string, { body }: { body: { allow: string; deny: string } }) => {
          const channelId = route.split("/")[2]!;
          calls.push(`put:${channelId}`);
          guild.channels.cache.get(channelId)!.permissionOverwrites.cache.set(GUILD_ID, {
            allow: { bitfield: BigInt(body.allow) },
            deny: { bitfield: BigInt(body.deny) },
          });
        },
        delete: async (route: string) => {
          const channelId = route.split("/")[2]!;
          calls.push(`delete:${channelId}`);
          guild.channels.cache.get(channelId)!.permissionOverwrites.cache.delete(GUILD_ID);
        },
      },
    },
  };

  return guild;
}

export const overwriteOf = (c: FakeChannel) => {
  const o = c.permissionOverwrites.cache.get(GUILD_ID);
  return o ? { allow: o.allow.bitfield, deny: o.deny.bitfield } : null;
};

/** Le garde complet sur des stockages en mémoire, avec une horloge réglable. */
export function setup(guild: FakeGuild, overrides: Partial<AntiRaidSettings> = {}) {
  let now = new Date("2026-11-06T12:00:00Z");
  const settings: AntiRaidSettings = { ...DEFAULT_ANTI_RAID, enabled: true, joinThreshold: 3, minAccountAgeDays: 0, ...overrides };
  const store = new MemoryRaidStore();
  const auditLog = new MemoryAuditLog();
  const sanctionStore = new MemorySanctionStore();
  const antiRaid = new AntiRaidService(store, async () => settings, () => now);
  const posted: unknown[] = [];
  const guard = createRaidGuard({
    client: { guilds: { cache: new Map([[GUILD_ID, guild]]) } } as never,
    antiRaid,
    sanctionService: new SanctionService(sanctionStore, () => now),
    auditLog,
    post: async (_guildId, panel) => {
      posted.push(panel);
      return true;
    },
  });

  return {
    guard,
    antiRaid,
    store,
    auditLog,
    sanctionStore,
    posted,
    settings,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
    actions: async () => (await auditLog.listForGuild(GUILD_ID, 100)).map((e) => e.action).sort(),
  };
}

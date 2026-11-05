import type { GuildStore } from "@/domain/guilds/guild-store.ts";
import type { BotGuild, GuildSettings } from "@/domain/guilds/guild-types.ts";

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryGuildStore implements GuildStore {
  readonly guilds = new Map<string, BotGuild>();
  readonly managers = new Map<string, readonly string[]>();
  readonly settings = new Map<string, GuildSettings>();

  async upsertGuild(guild: BotGuild): Promise<void> {
    this.guilds.set(guild.guildId, guild);
  }

  async removeGuild(guildId: string): Promise<void> {
    this.guilds.delete(guildId);
    this.managers.delete(guildId);
  }

  async retainGuilds(guildIds: readonly string[]): Promise<number> {
    const keep = new Set(guildIds);
    let removed = 0;

    for (const guildId of [...this.guilds.keys()]) {
      if (!keep.has(guildId)) {
        await this.removeGuild(guildId);
        removed += 1;
      }
    }

    return removed;
  }

  async replaceManagers(guildId: string, memberIds: readonly string[]): Promise<void> {
    this.managers.set(guildId, [...memberIds]);
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    return this.settings.get(guildId) ?? null;
  }

  async insertSettingsIfMissing(settings: GuildSettings): Promise<boolean> {
    if (this.settings.has(settings.guildId)) {
      return false;
    }

    this.settings.set(settings.guildId, settings);
    return true;
  }
}

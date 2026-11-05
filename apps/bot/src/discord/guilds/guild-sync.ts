import { PermissionFlagsBits, type Guild } from "discord.js";

import type { GuildService } from "@/domain/guilds/guild-service.ts";
import type { BotGuild } from "@/domain/guilds/guild-types.ts";
import { logger } from "@/shared/logger.ts";

/** Un changement de rôles arrive souvent en rafale : on attend qu'elle se calme avant d'écrire. */
const SYNC_DELAY_MS = 5_000;

/** Ce que le panneau affiche d'un serveur. */
export function snapshotGuild(guild: Guild): BotGuild {
  return {
    guildId: guild.id,
    name: guild.name,
    icon: guild.icon,
    banner: guild.banner,
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
  };
}

/**
 * Membres qui peuvent gérer le serveur : un de leurs rôles donne Administrateur ou « Gérer le
 * serveur ». Lit le cache des membres (rempli au démarrage par `guild.members.fetch()`).
 * Le propriétaire n'y figure pas forcément : il est connu par `owner_id`.
 */
export function managerIdsOf(guild: Guild): string[] {
  const ids = new Set<string>();

  for (const role of guild.roles.cache.values()) {
    if (role.permissions.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
      for (const member of role.members.values()) {
        if (!member.user.bot) {
          ids.add(member.id);
        }
      }
    }
  }

  return [...ids];
}

/** Tient à jour, pour chaque serveur, sa fiche et ses gestionnaires (accès au panneau). */
export class GuildSync {
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly guildService: GuildService) {}

  /** Écrit tout de suite (arrivée du bot, démarrage). */
  async syncNow(guild: Guild): Promise<void> {
    this.cancel(guild.id);

    try {
      await this.guildService.sync(snapshotGuild(guild), managerIdsOf(guild));
    } catch (error) {
      logger.warn("Guild sync failed", {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Écrit quelques secondes plus tard, une seule fois par rafale (rôles, membres, renommage). */
  schedule(guild: Guild): void {
    this.cancel(guild.id);
    this.pending.set(
      guild.id,
      setTimeout(() => {
        this.pending.delete(guild.id);
        void this.syncNow(guild);
      }, SYNC_DELAY_MS),
    );
  }

  async remove(guildId: string): Promise<void> {
    this.cancel(guildId);
    await this.guildService.remove(guildId);
  }

  stop(): void {
    for (const timer of this.pending.values()) {
      clearTimeout(timer);
    }

    this.pending.clear();
  }

  private cancel(guildId: string): void {
    const timer = this.pending.get(guildId);

    if (timer) {
      clearTimeout(timer);
      this.pending.delete(guildId);
    }
  }
}

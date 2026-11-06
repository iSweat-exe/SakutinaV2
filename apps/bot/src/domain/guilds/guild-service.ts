import type { GuildStore } from "./guild-store.ts";
import { defaultSettings, type BotGuild, type GuildChannelEntry, type GuildSettings } from "./guild-types.ts";

/**
 * Les réglages sont lus à chaque interaction : un court cache évite un aller-retour à la base par message. Il est court
 * parce que le panneau les change directement en base : un réglage doit s'appliquer presque tout de suite.
 */
export const SETTINGS_TTL_MS = 10_000;

type CachedSettings = Readonly<{ settings: GuildSettings; expiresAt: number }>;

/** Serveurs du bot, gestionnaires (accès au panneau) et réglages par serveur. */
export class GuildService {
  private readonly cache = new Map<string, CachedSettings>();

  constructor(
    private readonly store: GuildStore,
    private readonly now: () => number = Date.now,
  ) {}

  /** Arrivée ou mise à jour d'un serveur : sa fiche, ses gestionnaires et, si donnés, les salons où le bot écrit. */
  async sync(guild: BotGuild, managerIds: readonly string[], channels?: readonly GuildChannelEntry[]): Promise<void> {
    await this.store.upsertGuild(guild);
    await this.store.replaceManagers(guild.guildId, [...new Set(managerIds)]);

    if (channels) {
      await this.store.replaceChannels(guild.guildId, channels);
    }
  }

  /** Change le salon d'alertes du serveur ; s'applique tout de suite. */
  async setAlertChannel(guildId: string, channelId: string | null): Promise<void> {
    await this.store.setAlertChannel(guildId, channelId);
    this.cache.delete(guildId);
  }

  async remove(guildId: string): Promise<void> {
    this.cache.delete(guildId);
    await this.store.removeGuild(guildId);
  }

  /** Au démarrage : oublie les serveurs quittés pendant que le bot était éteint. */
  async retain(guildIds: readonly string[]): Promise<number> {
    return this.store.retainGuilds(guildIds);
  }

  /** Réglages du serveur ; un serveur sans réglages reçoit les valeurs par défaut (aucun rôle, aucun salon). */
  async settings(guildId: string): Promise<GuildSettings> {
    const cached = this.cache.get(guildId);

    if (cached && cached.expiresAt > this.now()) {
      return cached.settings;
    }

    const settings = (await this.store.getSettings(guildId)) ?? defaultSettings(guildId);
    this.cache.set(guildId, { settings, expiresAt: this.now() + SETTINGS_TTL_MS });

    return settings;
  }

  /**
   * Reprend une seule fois les anciens réglages par variables d'environnement (mono-serveur)
   * pour le serveur historique. Sans effet si le serveur a déjà des réglages.
   */
  async seedLegacySettings(settings: GuildSettings): Promise<boolean> {
    const hasValues =
      settings.adminRoleIds.length > 0 || settings.moderatorRoleIds.length > 0 || settings.alertChannelId !== null;

    if (!hasValues) {
      return false;
    }

    const written = await this.store.insertSettingsIfMissing(settings);
    this.cache.delete(settings.guildId);

    return written;
  }
}

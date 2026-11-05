import type { BotGuild, GuildSettings } from "./guild-types.ts";

/** Persistance des serveurs du bot, de leurs gestionnaires et de leurs réglages. */
export interface GuildStore {
  /** Crée ou met à jour un serveur (nom, icône, bannière, propriétaire, nombre de membres). */
  upsertGuild(guild: BotGuild): Promise<void>;

  /** Le bot a quitté le serveur : retire sa fiche et ses gestionnaires (les réglages restent). */
  removeGuild(guildId: string): Promise<void>;

  /** Retire les serveurs absents de `guildIds` (quittés pendant que le bot était éteint) ; renvoie leur nombre. */
  retainGuilds(guildIds: readonly string[]): Promise<number>;

  /** Remplace la liste des membres qui peuvent gérer le serveur. */
  replaceManagers(guildId: string, memberIds: readonly string[]): Promise<void>;

  /** Réglages du serveur, ou `null` s'il n'en a pas encore. */
  getSettings(guildId: string): Promise<GuildSettings | null>;

  /** Enregistre des réglages seulement si le serveur n'en a pas ; `true` s'ils ont été écrits. */
  insertSettingsIfMissing(settings: GuildSettings): Promise<boolean>;
}

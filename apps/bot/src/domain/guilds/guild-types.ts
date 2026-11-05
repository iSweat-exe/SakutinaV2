/** Un serveur où le bot est présent, tel que le panneau l'affiche. */
export type BotGuild = Readonly<{
  guildId: string;
  name: string;
  /** Hash de l'icône Discord, ou `null`. */
  icon: string | null;
  /** Hash de la bannière Discord, ou `null`. */
  banner: string | null;
  ownerId: string;
  memberCount: number;
}>;

/** Réglages propres à un serveur, lus par le bot. */
export type GuildSettings = Readonly<{
  guildId: string;
  /** Rôles reconnus comme administrateurs du bot, en plus des permissions Discord. */
  adminRoleIds: readonly string[];
  /** Rôles reconnus comme modérateurs du bot. */
  moderatorRoleIds: readonly string[];
  /** Salon où Phaéthon publie ses alertes ; sans lui, les alertes sont seulement journalisées. */
  alertChannelId: string | null;
}>;

export function defaultSettings(guildId: string): GuildSettings {
  return { guildId, adminRoleIds: [], moderatorRoleIds: [], alertChannelId: null };
}

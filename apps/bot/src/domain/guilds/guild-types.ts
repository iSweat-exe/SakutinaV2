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
  /** Nom de la monnaie affiché aux membres (« pièces » par défaut). */
  currencyName: string;
  /** Récompense de base de `/economy daily` (le bonus de série s'y ajoute). */
  dailyReward: number;
  /** Pièces offertes à chaque nouveau membre à son arrivée ; 0 = aucune. */
  startingBalance: number;
  /** Part prélevée par le serveur sur chaque `/economy pay`, en pourcentage entier (0 à 25). */
  transferTaxPercent: number;
}>;

export const DEFAULT_CURRENCY = "pièces";
export const DEFAULT_DAILY_REWARD = 200;

export function defaultSettings(guildId: string): GuildSettings {
  return {
    guildId,
    adminRoleIds: [],
    moderatorRoleIds: [],
    alertChannelId: null,
    currencyName: DEFAULT_CURRENCY,
    dailyReward: DEFAULT_DAILY_REWARD,
    startingBalance: 0,
    transferTaxPercent: 0,
  };
}

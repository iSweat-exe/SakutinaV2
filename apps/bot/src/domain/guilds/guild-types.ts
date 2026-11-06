import { DEFAULT_ANTI_RAID, type AntiRaidSettings } from "@/domain/anti-raid/anti-raid-rules.ts";
import { defaultCasinoSettings, type CasinoSettings } from "@/domain/casino/casino-rules.ts";
import {
  IDLE_TAX_DEFAULT_PERMILLE,
  SALARY_BUDGET_DEFAULT_PERMILLE,
  WEALTH_TAX_DEFAULT_PERMILLE,
} from "@/domain/economy/economy-rules.ts";

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
  /**
   * Budget quotidien des salaires (`/economy work` et `/economy daily`), en pour mille de la réserve (10 = 1 % par
   * jour), partagé entre les membres actifs.
   */
  salaryBudgetPermille: number;
  /** Pièces offertes à chaque nouveau membre à son arrivée ; 0 = aucune. */
  startingBalance: number;
  /** Part prélevée par le serveur sur chaque `/economy pay`, en pourcentage entier (0 à 25). */
  transferTaxPercent: number;
  /**
   * Intérêt quotidien de la banque, en pour mille (0 = aucun, 50 au plus = 5 %). Payé par le trésor du serveur, jamais
   * créé de rien.
   */
  bankInterestPermille: number;
  /** Impôt hebdomadaire sur la fortune au-delà du seuil, en pour mille : membres actifs, puis comptes inactifs. */
  wealthTaxPermille: number;
  idleTaxPermille: number;
  /** Jeux du casino : ouverts ou fermés, et mise maximale de chacun. */
  casino: CasinoSettings;
  /** Auto-modération : chaque filtre s'active séparément (tous éteints par défaut). */
  automod: AutomodSettings;
  /** Anti-raid : détection des rafales d'arrivées et réponse (éteint par défaut). */
  antiRaid: AntiRaidSettings;
}>;

export type AutomodSettings = Readonly<{
  /** Messages répétés ou en rafale. */
  spam: boolean;
  /** Invitations et liens des membres arrivés depuis moins de 7 jours. */
  links: boolean;
  /** Messages contenant un mot de `bannedWords`. */
  words: boolean;
  /** Plus de 5 personnes mentionnées d'un coup. */
  mentions: boolean;
  bannedWords: readonly string[];
  /** Durée du mute infligé par l'auto-modération, en minutes. */
  muteMinutes: number;
}>;

export const DEFAULT_AUTOMOD: AutomodSettings = {
  spam: false,
  links: false,
  words: false,
  mentions: false,
  bannedWords: [],
  muteMinutes: 60,
};

export const DEFAULT_CURRENCY = "pièces";

export function defaultSettings(guildId: string): GuildSettings {
  return {
    guildId,
    adminRoleIds: [],
    moderatorRoleIds: [],
    alertChannelId: null,
    currencyName: DEFAULT_CURRENCY,
    salaryBudgetPermille: SALARY_BUDGET_DEFAULT_PERMILLE,
    startingBalance: 0,
    transferTaxPercent: 0,
    bankInterestPermille: 0,
    wealthTaxPermille: WEALTH_TAX_DEFAULT_PERMILLE,
    idleTaxPermille: IDLE_TAX_DEFAULT_PERMILLE,
    casino: defaultCasinoSettings(),
    automod: DEFAULT_AUTOMOD,
    antiRaid: DEFAULT_ANTI_RAID,
  };
}

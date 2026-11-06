/**
 * Règles de l'anti-raid : ce qui déclare un raid et ce que le bot fait pendant qu'il dure. Valeurs réglées par
 * serveur depuis le panneau (`guild_settings.antiraid_*`), bornées ici et en base.
 */

/** Ce que le bot fait des comptes arrivés pendant un raid. « watch » : il alerte seulement (mode observation). */
export const RAID_ACTIONS = ["watch", "quarantine", "kick", "ban"] as const;
export type RaidAction = (typeof RAID_ACTIONS)[number];

export type AntiRaidSettings = Readonly<{
  enabled: boolean;
  /** Arrivées (pondérées) dans la fenêtre au-delà desquelles un raid est déclaré. */
  joinThreshold: number;
  /** Durée de la fenêtre glissante, en secondes. */
  windowSeconds: number;
  /** Un compte Discord plus jeune que ce nombre de jours compte double ; 0 = tous comptent pour un. */
  minAccountAgeDays: number;
  action: RaidAction;
  /** Retire à @everyone le droit d'écrire dans les salons tant que le raid dure. */
  lockChannels: boolean;
  /** Publie le début et la fin du raid dans le salon d'alertes. */
  alertAdmins: boolean;
  /** Passe la vérification du serveur au plus haut niveau (téléphone vérifié) tant que le raid dure. */
  raiseVerification: boolean;
}>;

export const JOIN_THRESHOLD = { min: 3, max: 50 } as const;
export const WINDOW_SECONDS = { min: 5, max: 120 } as const;
export const MIN_ACCOUNT_AGE_DAYS = { min: 0, max: 30 } as const;

export const DEFAULT_ANTI_RAID: AntiRaidSettings = {
  enabled: false,
  joinThreshold: 10,
  windowSeconds: 30,
  minAccountAgeDays: 7,
  action: "quarantine",
  lockChannels: true,
  alertAdmins: true,
  raiseVerification: false,
};

/** Un raid déclaré par la rafale prend fin après ce délai sans nouvelle arrivée. Un verrouillage manuel, jamais seul. */
export const RAID_CALM_MS = 2 * 60_000;

/** Durée de la quarantaine (timeout Discord) : le temps qu'un modérateur trie, levable depuis le panneau. */
export const QUARANTINE_MS = 24 * 60 * 60_000;

/** Messages des 60 dernières minutes supprimés avec un bannissement d'anti-raid. */
export const BAN_DELETE_MESSAGE_SECONDS = 3_600;

/** Raids conservés un an : aucun identifiant de membre visé, seulement des compteurs et l'administrateur. */
export const RAID_RETENTION_DAYS = 365;

/** Niveau de vérification Discord « téléphone vérifié » (le plus haut). */
export const HIGHEST_VERIFICATION_LEVEL = 4;

const DISCORD_EPOCH_MS = 1_420_070_400_000n;
const DAY_MS = 86_400_000;

/** Date de création d'un compte Discord, lue dans son identifiant ; `null` pour un identifiant invalide. */
export function accountCreatedAt(memberId: string): Date | null {
  if (!/^\d{5,25}$/.test(memberId)) {
    return null;
  }

  return new Date(Number((BigInt(memberId) >> 22n) + DISCORD_EPOCH_MS));
}

/** Poids d'une arrivée : 2 pour un compte plus jeune que `minAccountAgeDays`, 1 sinon. */
export function joinWeight(memberId: string, at: Date, minAccountAgeDays: number): 1 | 2 {
  const created = accountCreatedAt(memberId);

  if (minAccountAgeDays <= 0 || !created) {
    return 1;
  }

  return at.getTime() - created.getTime() < minAccountAgeDays * DAY_MS ? 2 : 1;
}

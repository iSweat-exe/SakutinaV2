import type {
  EdgeSnapshot,
  GameTotal,
  IdentityChangeCount,
  IdentityEvent,
  MemberHourRow,
  PhaethonBatch,
  PresenceTotals,
} from "./phaethon-types.ts";

/** Persistance de Phaéthon. Les périodes sont des jours UTC (AAAA-MM-JJ). */
export interface PhaethonStore {
  /** Ajoute (additivement) les compteurs du lot ; les changements d'identité sont dédoublonnés par `id`. */
  add(batch: PhaethonBatch): Promise<void>;

  /** Les interactions dont `memberId` est la source ou la cible, depuis `sinceDay` inclus. */
  edgesForMember(guildId: string, memberId: string, sinceDay: string): Promise<readonly EdgeSnapshot[]>;

  /** Les interactions entre deux membres, dans les deux sens. */
  edgesBetween(
    guildId: string,
    leftId: string,
    rightId: string,
    sinceDay: string,
  ): Promise<readonly EdgeSnapshot[]>;

  /** Membres ayant une interaction avec `memberId` (dans un sens ou l'autre). */
  contactIds(guildId: string, memberId: string, sinceDay: string): Promise<readonly string[]>;

  /** Messages par heure UTC (24 valeurs) d'un membre. */
  hoursForMember(guildId: string, memberId: string, sinceDay: string): Promise<readonly number[]>;

  /** Messages par membre et par heure UTC, pour toute la communauté. */
  hoursByMember(guildId: string, sinceDay: string): Promise<readonly MemberHourRow[]>;

  presenceForMember(guildId: string, memberId: string, sinceDay: string): Promise<PresenceTotals>;

  gamesForMember(
    guildId: string,
    memberId: string,
    sinceDay: string,
    limit: number,
  ): Promise<readonly GameTotal[]>;

  /** Membres ayant passé du temps sur un jeu dont le nom contient `query` (sans tenir compte de la casse). */
  membersPlaying(guildId: string, sinceDay: string, query: string): Promise<readonly string[]>;

  /** Derniers changements d'identité, du plus récent au plus ancien. */
  identityHistory(guildId: string, memberId: string, limit: number): Promise<readonly IdentityEvent[]>;

  /** Nombre de changements de nom, de pseudo ou d'avatar par membre depuis `since`. */
  identityChangeCounts(guildId: string, since: Date): Promise<readonly IdentityChangeCount[]>;

  /** Réserve une alerte : `true` la première fois, `false` si elle a déjà été émise. */
  claimAlert(guildId: string, key: string, at: Date): Promise<boolean>;

  /** Efface tout ce qui concerne un membre, comme source comme cible. */
  deleteMember(guildId: string, memberId: string): Promise<void>;

  /** Supprime les jours antérieurs à `day`, ainsi que identités et alertes antérieures à `cutoff` ; renvoie le nombre de lignes retirées. */
  purgeBefore(day: string, cutoff: Date): Promise<number>;
}

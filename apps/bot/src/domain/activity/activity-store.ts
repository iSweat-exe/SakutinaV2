import type {
  ActivityBatch,
  ActivitySnapshot,
  ChannelMetric,
  ChannelTotal,
  GuildTotals,
  LeaderboardRow,
  MemberTotals,
  MonthlySummary,
} from "./activity-types.ts";
import type { CounterName } from "./counters.ts";

/** Persistance des agrégats d'activité. Les périodes sont des jours UTC (AAAA-MM-JJ). */
export interface ActivityStore {
  /** Ajoute (additivement) les compteurs du lot ; `presences` est géré par `MemberStore`. */
  add(batch: Omit<ActivityBatch, "presences">): Promise<void>;

  listForMember(
    guildId: string,
    memberId: string,
  ): Promise<readonly ActivitySnapshot[]>;

  /** Classement des membres sur un compteur depuis `sinceDay` inclus, valeurs nulles exclues. */
  leaderboard(
    guildId: string,
    counter: CounterName,
    sinceDay: string,
    limit: number,
  ): Promise<readonly LeaderboardRow[]>;

  guildTotals(guildId: string, sinceDay: string): Promise<GuildTotals>;

  topChannels(
    guildId: string,
    metric: ChannelMetric,
    sinceDay: string,
    limit: number,
  ): Promise<readonly ChannelTotal[]>;

  /** Totaux de chaque membre depuis `sinceDay` inclus (les membres sans activité sont absents). */
  totalsByMember(guildId: string, sinceDay: string): Promise<readonly MemberTotals[]>;

  /** Salons les plus utilisés par un membre depuis `sinceDay` inclus. */
  channelsForMember(
    guildId: string,
    memberId: string,
    metric: ChannelMetric,
    sinceDay: string,
    limit: number,
  ): Promise<readonly ChannelTotal[]>;

  /** Résumés mensuels d'un membre, du plus récent au plus ancien. */
  monthlyForMember(guildId: string, memberId: string, limit: number): Promise<readonly MonthlySummary[]>;

  /** Messages par heure UTC (24 valeurs) depuis `sinceDay` inclus. */
  hourlyMessages(guildId: string, sinceDay: string): Promise<readonly number[]>;

  /** Supprime les données individuelles d'un membre, résumés mensuels compris (l'agrégat horaire est anonyme). */
  deleteMember(guildId: string, memberId: string): Promise<void>;

  /**
   * Supprime les jours strictement antérieurs à `day` ; renvoie le nombre de lignes retirées.
   * Avant de supprimer, le détail quotidien des membres est résumé par mois : le détail
   * disparaît, la tendance reste.
   */
  purgeBefore(day: string): Promise<number>;
}

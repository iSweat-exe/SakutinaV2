import type {
  ActivityBatch,
  ActivitySnapshot,
  ChannelMetric,
  ChannelTotal,
  GuildTotals,
  LeaderboardRow,
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

  /** Messages par heure UTC (24 valeurs) depuis `sinceDay` inclus. */
  hourlyMessages(guildId: string, sinceDay: string): Promise<readonly number[]>;

  /** Supprime les données individuelles d'un membre (l'agrégat horaire est anonyme). */
  deleteMember(guildId: string, memberId: string): Promise<void>;

  /** Supprime les jours strictement antérieurs à `day` ; renvoie le nombre de lignes retirées. */
  purgeBefore(day: string): Promise<number>;
}

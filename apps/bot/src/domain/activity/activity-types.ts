import type { Counters } from "./counters.ts";

/** Compteurs d'un membre pour un jour UTC. */
export type ActivitySnapshot = Readonly<{
  guildId: string;
  memberId: string;
  /** AAAA-MM-JJ, UTC. */
  day: string;
}> &
  Counters;

/** Messages et temps vocal d'un membre dans un salon, pour un jour UTC. */
export type ChannelSnapshot = Readonly<{
  guildId: string;
  memberId: string;
  channelId: string;
  day: string;
  messages: number;
  voiceSeconds: number;
}>;

/** Messages et temps vocal d'un serveur pour une heure UTC (sans membre : agrégat anonyme). */
export type HourlySnapshot = Readonly<{
  guildId: string;
  day: string;
  /** 0 à 23, UTC. */
  hour: number;
  messages: number;
  voiceSeconds: number;
}>;

/** Dernière activité observée d'un membre. */
export type PresenceDelta = Readonly<{
  guildId: string;
  memberId: string;
  at: Date;
}>;

/** Tout ce que le tampon accumule entre deux écritures. */
export type ActivityBatch = Readonly<{
  daily: readonly ActivitySnapshot[];
  channels: readonly ChannelSnapshot[];
  hourly: readonly HourlySnapshot[];
  presences: readonly PresenceDelta[];
}>;

export const EMPTY_BATCH: ActivityBatch = {
  daily: [],
  channels: [],
  hourly: [],
  presences: [],
};

export function isEmptyBatch(batch: ActivityBatch): boolean {
  return (
    batch.daily.length === 0 &&
    batch.channels.length === 0 &&
    batch.hourly.length === 0 &&
    batch.presences.length === 0
  );
}

export type LeaderboardRow = Readonly<{ memberId: string; value: number }>;

export type GuildTotals = Readonly<{
  totals: Counters;
  /** Membres distincts ayant écrit ou parlé sur la période. */
  activeMembers: number;
}>;

export type ChannelMetric = "messages" | "voiceSeconds";

export type ChannelTotal = Readonly<{ channelId: string; value: number }>;

/** Résumé durable d'un membre pour un mois UTC (AAAA-MM) : les compteurs du détail purgé. */
export type MonthlySummary = Readonly<{
  month: string;
  /** Jours du mois où le membre a écrit ou parlé. */
  activeDays: number;
}> &
  Counters;

export type MemberTotals = Readonly<{ memberId: string }> & Counters;

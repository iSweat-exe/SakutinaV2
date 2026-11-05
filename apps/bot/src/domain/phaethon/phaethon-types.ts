import type { ChannelTotal, MonthlySummary } from "@/domain/activity/activity-types.ts";
import type { Counters } from "@/domain/activity/counters.ts";
import type { MemberTag, MemberTagId } from "@/domain/insights/member-tags.ts";
import type { MemberProfile } from "@/domain/members/member-profile.ts";

/**
 * Phaéthon : le profilage du serveur. Seules des métadonnées sont conservées
 * (nombres, durées, noms publics, dates) : jamais le contenu d'un message.
 */

export const EDGE_METRICS = ["replies", "mentions", "reactions", "voiceSeconds"] as const;
export type EdgeMetric = (typeof EDGE_METRICS)[number];

/** Interactions dirigées de `memberId` vers `targetId` pour un jour UTC. */
export type EdgeSnapshot = Readonly<{
  guildId: string;
  memberId: string;
  targetId: string;
  day: string;
}> &
  Readonly<Record<EdgeMetric, number>>;

/** Messages d'un membre pour une heure UTC. */
export type MemberHourSnapshot = Readonly<{
  guildId: string;
  memberId: string;
  day: string;
  hour: number;
  messages: number;
}>;

export const PRESENCE_STATUSES = ["online", "idle", "dnd"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export type StatusSnapshot = Readonly<{
  guildId: string;
  memberId: string;
  day: string;
  status: PresenceStatus;
  seconds: number;
}>;

export const GAME_KINDS = ["playing", "streaming", "listening", "watching", "competing"] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export type GameSnapshot = Readonly<{
  guildId: string;
  memberId: string;
  day: string;
  name: string;
  kind: GameKind;
  seconds: number;
}>;

export const IDENTITY_KINDS = [
  "nickname",
  "username",
  "display-name",
  "avatar",
  "roles",
  "boost",
  "timeout",
] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];

/** Un changement d'identité daté. `oldValue` / `newValue` sont des noms, des empreintes ou des identifiants de rôles. */
export type IdentityEvent = Readonly<{
  id: string;
  guildId: string;
  memberId: string;
  kind: IdentityKind;
  oldValue: string | null;
  newValue: string | null;
  at: Date;
}>;

export type PhaethonBatch = Readonly<{
  edges: readonly EdgeSnapshot[];
  hours: readonly MemberHourSnapshot[];
  statuses: readonly StatusSnapshot[];
  games: readonly GameSnapshot[];
  identity: readonly IdentityEvent[];
}>;

export const EMPTY_PHAETHON_BATCH: PhaethonBatch = {
  edges: [],
  hours: [],
  statuses: [],
  games: [],
  identity: [],
};

export function isEmptyPhaethonBatch(batch: PhaethonBatch): boolean {
  return (
    batch.edges.length === 0 &&
    batch.hours.length === 0 &&
    batch.statuses.length === 0 &&
    batch.games.length === 0 &&
    batch.identity.length === 0
  );
}

export type PresenceTotals = Readonly<Record<PresenceStatus, number>>;

export type GameTotal = Readonly<{ name: string; kind: GameKind; seconds: number }>;

export type MemberHourRow = Readonly<{ memberId: string; hour: number; messages: number }>;

export type IdentityChangeCount = Readonly<{ memberId: string; count: number }>;

/** Un membre en relation avec le membre observé : ce qu'ils ont échangé. */
export type Contact = Readonly<{
  otherId: string;
  sent: Readonly<{ replies: number; mentions: number; reactions: number }>;
  received: Readonly<{ replies: number; mentions: number; reactions: number }>;
  voiceSeconds: number;
  /** Poids total (10 minutes de vocal = 1 interaction) : sert au classement. */
  score: number;
}>;

/** Le dossier complet d'un membre, tel que l'assemble `PhaethonService.dossier`. */
export type Dossier = Readonly<{
  guildId: string;
  memberId: string;
  profile: MemberProfile | null;
  /** Fenêtre d'observation, en jours. */
  days: number;
  totals: Counters;
  tags: readonly MemberTag[];
  /** Salons les plus utilisés (messages), puis en vocal. */
  textChannels: readonly ChannelTotal[];
  voiceChannels: readonly ChannelTotal[];
  /** Messages par heure UTC (24 valeurs). */
  hours: readonly number[];
  /** Part des messages envoyés pendant la nuit (0 à 1). */
  nightShare: number;
  contacts: readonly Contact[];
  presence: PresenceTotals;
  games: readonly GameTotal[];
  identity: readonly IdentityEvent[];
  monthly: readonly MonthlySummary[];
}>;

export type SearchSort = "messages" | "voice" | "social" | "recent";

export type SearchCriteria = Readonly<{
  minMessages?: number;
  minVoiceHours?: number;
  nightOwl?: boolean;
  joinedWithinDays?: number;
  inactiveDays?: number;
  game?: string;
  tag?: MemberTagId;
  talksTo?: string;
  sort: SearchSort;
}>;

export type SearchHit = Readonly<{
  memberId: string;
  totals: Counters;
  nightShare: number;
  tags: readonly MemberTag[];
  lastActiveAt: Date | null;
}>;

export type Comparison = Readonly<{
  left: Dossier;
  right: Dossier;
  /** Ce que `left` a envoyé à `right`, et inversement. */
  leftToRight: Readonly<{ replies: number; mentions: number; reactions: number }>;
  rightToLeft: Readonly<{ replies: number; mentions: number; reactions: number }>;
  voiceTogetherSeconds: number;
  sharedContacts: readonly string[];
  sharedGames: readonly string[];
  /** Ressemblance des rythmes horaires (0 à 1). */
  rhythmSimilarity: number;
}>;

export type AlertKind = "suspicious-account" | "identity-churn" | "gone-quiet" | "activity-spike";

export type Alert = Readonly<{
  kind: AlertKind;
  memberId: string;
  /** La mesure observée et le seuil franchi : une alerte reste explicable. */
  measured: number;
  threshold: number;
  at: Date;
}>;

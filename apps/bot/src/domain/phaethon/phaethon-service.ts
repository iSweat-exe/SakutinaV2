import { retentionCutoff, windowStart, type ActivityService } from "@/domain/activity/activity-service.ts";
import { dayOf } from "@/domain/activity/activity-tracker.ts";
import { EMPTY_COUNTERS, type Counters } from "@/domain/activity/counters.ts";
import { TAG_WINDOW_DAYS } from "@/domain/insights/insight-rules.ts";
import { computeTags } from "@/domain/insights/member-tags.ts";
import { inactivityReference, type MemberProfile } from "@/domain/members/member-profile.ts";
import type { MemberService } from "@/domain/members/member-service.ts";
import { logger } from "@/shared/logger.ts";
import {
  activitySpike,
  alertKey,
  goneQuiet,
  identityChurn,
  suspiciousAccount,
} from "./phaethon-alerts.ts";
import {
  DOSSIER_WINDOW_DAYS,
  NIGHT_HOURS_UTC,
  NIGHT_OWL_MIN_MESSAGES,
  NIGHT_OWL_SHARE,
  VOICE_SECONDS_PER_INTERACTION,
} from "./phaethon-rules.ts";
import type { PhaethonStore } from "./phaethon-store.ts";
import type { PhaethonTracker } from "./phaethon-tracker.ts";
import {
  isEmptyPhaethonBatch,
  type Alert,
  type Comparison,
  type Contact,
  type Dossier,
  type EdgeSnapshot,
  type MemberHourRow,
  type SearchCriteria,
  type SearchHit,
} from "./phaethon-types.ts";

const DAY_MS = 86_400_000;
const DOSSIER_CONTACTS = 25;
const DOSSIER_GAMES = 8;
const DOSSIER_CHANNELS = 5;
const DOSSIER_IDENTITY = 8;
const DOSSIER_MONTHS = 6;
const ALERT_CANDIDATES = 50;

const nightHours = new Set(NIGHT_HOURS_UTC);

/** Part des messages envoyés la nuit (0 à 1) à partir de 24 compteurs horaires. */
export function nightShareOf(hours: readonly number[]): number {
  const total = hours.reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return 0;
  }

  return hours.reduce((sum, value, hour) => (nightHours.has(hour) ? sum + value : sum), 0) / total;
}

/** Ressemblance (cosinus) de deux rythmes horaires : 1 = même profil, 0 = rien en commun. */
export function rhythmSimilarity(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let hour = 0; hour < 24; hour += 1) {
    const a = left[hour] ?? 0;
    const b = right[hour] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  return leftNorm === 0 || rightNorm === 0 ? 0 : dot / Math.sqrt(leftNorm * rightNorm);
}

type Direction = { replies: number; mentions: number; reactions: number };
const noDirection = (): Direction => ({ replies: 0, mentions: 0, reactions: 0 });

/** Regroupe les interactions dirigées en un contact par autre membre, du plus important au moins important. */
export function contactsOf(memberId: string, edges: readonly EdgeSnapshot[], limit: number): Contact[] {
  const contacts = new Map<string, { sent: Direction; received: Direction; voiceSeconds: number }>();
  const entry = (otherId: string) => {
    const existing = contacts.get(otherId);

    if (existing) {
      return existing;
    }

    const created = { sent: noDirection(), received: noDirection(), voiceSeconds: 0 };
    contacts.set(otherId, created);

    return created;
  };

  for (const edge of edges) {
    if (edge.memberId === memberId) {
      const contact = entry(edge.targetId);
      contact.sent.replies += edge.replies;
      contact.sent.mentions += edge.mentions;
      contact.sent.reactions += edge.reactions;
      // Le vocal est enregistré dans les deux sens : on ne compte que le sens sortant.
      contact.voiceSeconds += edge.voiceSeconds;
    } else if (edge.targetId === memberId) {
      const contact = entry(edge.memberId);
      contact.received.replies += edge.replies;
      contact.received.mentions += edge.mentions;
      contact.received.reactions += edge.reactions;
    }
  }

  return [...contacts.entries()]
    .map(([otherId, { sent, received, voiceSeconds }]): Contact => ({
      otherId,
      sent,
      received,
      voiceSeconds,
      score:
        sent.replies + sent.mentions + sent.reactions +
        received.replies + received.mentions + received.reactions +
        Math.floor(voiceSeconds / VOICE_SECONDS_PER_INTERACTION),
    }))
    .filter((contact) => contact.score > 0)
    .sort((a, b) => b.score - a.score || a.otherId.localeCompare(b.otherId))
    .slice(0, limit);
}

function sumDirection(edges: readonly EdgeSnapshot[], from: string, to: string): Direction {
  const total = noDirection();

  for (const edge of edges) {
    if (edge.memberId === from && edge.targetId === to) {
      total.replies += edge.replies;
      total.mentions += edge.mentions;
      total.reactions += edge.reactions;
    }
  }

  return total;
}

/**
 * Phaéthon : assemble ce que le bot sait d'un membre (activité, rythme,
 * relations, présence, identité) et en tire dossiers, recherches, comparaisons
 * et alertes. Il ne manipule que des métadonnées : jamais le contenu d'un message.
 */
export class PhaethonService {
  constructor(
    private readonly tracker: PhaethonTracker,
    private readonly store: PhaethonStore,
    private readonly activity: ActivityService,
    private readonly members: MemberService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Renvoie `true` si tout a été écrit ; sinon le lot est remis en tampon. */
  async flush(): Promise<boolean> {
    const batch = this.tracker.drain();

    if (isEmptyPhaethonBatch(batch)) {
      return true;
    }

    try {
      await this.store.add(batch);
      return true;
    } catch (error) {
      this.tracker.restore(batch);
      logger.error("Failed to flush phaethon data", {
        edges: batch.edges.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /** Écrit les deux tampons (activité et Phaéthon) : les lectures qui suivent voient tout, fiches comprises. */
  private async settle(): Promise<void> {
    await this.activity.flush();
    await this.flush();
  }

  /** Le dossier complet d'un membre sur les `days` derniers jours (30 au plus : c'est le détail conservé). */
  async dossier(guildId: string, memberId: string, days = DOSSIER_WINDOW_DAYS): Promise<Dossier> {
    await this.settle();

    const now = this.clock();
    const since = windowStart(now, days);
    const window = Math.min(days, DOSSIER_WINDOW_DAYS);
    const [profile, totals, tagTotals, textChannels, voiceChannels, hours, edges, presence, games, identity, monthly] =
      await Promise.all([
        this.members.find(guildId, memberId),
        this.activity.totalsForMember(guildId, memberId, window),
        this.activity.totalsForMember(guildId, memberId, TAG_WINDOW_DAYS),
        this.activity.channelsForMember(guildId, memberId, "messages", window, DOSSIER_CHANNELS),
        this.activity.channelsForMember(guildId, memberId, "voiceSeconds", window, DOSSIER_CHANNELS),
        this.store.hoursForMember(guildId, memberId, since),
        this.store.edgesForMember(guildId, memberId, since),
        this.store.presenceForMember(guildId, memberId, since),
        this.store.gamesForMember(guildId, memberId, since, DOSSIER_GAMES),
        this.store.identityHistory(guildId, memberId, DOSSIER_IDENTITY),
        this.activity.monthlyForMember(guildId, memberId, DOSSIER_MONTHS),
      ]);

    return {
      guildId,
      memberId,
      profile,
      days: window,
      totals,
      tags: computeTags({ totals: tagTotals, profile, now }),
      textChannels,
      voiceChannels,
      hours,
      nightShare: nightShareOf(hours),
      contacts: contactsOf(memberId, edges, DOSSIER_CONTACTS),
      presence,
      games,
      identity,
      monthly,
    };
  }

  async compare(guildId: string, leftId: string, rightId: string): Promise<Comparison> {
    const [left, right] = await Promise.all([this.dossier(guildId, leftId), this.dossier(guildId, rightId)]);
    const since = windowStart(this.clock(), DOSSIER_WINDOW_DAYS);
    const between = await this.store.edgesBetween(guildId, leftId, rightId, since);
    const rightContacts = new Set(right.contacts.map((contact) => contact.otherId));
    const rightGames = new Set(right.games.map((game) => game.name.toLowerCase()));

    return {
      left,
      right,
      leftToRight: sumDirection(between, leftId, rightId),
      rightToLeft: sumDirection(between, rightId, leftId),
      voiceTogetherSeconds: between
        .filter((edge) => edge.memberId === leftId)
        .reduce((sum, edge) => sum + edge.voiceSeconds, 0),
      sharedContacts: left.contacts
        .map((contact) => contact.otherId)
        .filter((id) => rightContacts.has(id) && id !== leftId && id !== rightId),
      sharedGames: left.games.map((game) => game.name).filter((name) => rightGames.has(name.toLowerCase())),
      rhythmSimilarity: rhythmSimilarity(left.hours, right.hours),
    };
  }

  /** Recherche de membres par critères combinés (ET) sur les 30 derniers jours. */
  async search(guildId: string, criteria: SearchCriteria, limit: number): Promise<readonly SearchHit[]> {
    await this.settle();

    const now = this.clock();
    const since = windowStart(now, DOSSIER_WINDOW_DAYS);
    const [profiles, totalsList, hourRows, players, contacts] = await Promise.all([
      this.members.listPresent(guildId),
      this.activity.totalsByMember(guildId, DOSSIER_WINDOW_DAYS),
      criteria.nightOwl ? this.store.hoursByMember(guildId, since) : Promise.resolve([] as MemberHourRow[]),
      criteria.game ? this.store.membersPlaying(guildId, since, criteria.game) : Promise.resolve(null),
      criteria.talksTo ? this.store.contactIds(guildId, criteria.talksTo, since) : Promise.resolve(null),
    ]);

    const totals = new Map(totalsList.map((row) => [row.memberId, row]));
    const hoursOf = new Map<string, number[]>();

    for (const row of hourRows) {
      const hours = hoursOf.get(row.memberId) ?? Array.from({ length: 24 }, () => 0);
      hours[row.hour] = (hours[row.hour] ?? 0) + row.messages;
      hoursOf.set(row.memberId, hours);
    }

    const playerSet = players ? new Set(players) : null;
    const contactSet = contacts ? new Set(contacts) : null;
    const hits: SearchHit[] = [];

    for (const profile of profiles) {
      const memberTotals: Counters = totals.get(profile.memberId) ?? EMPTY_COUNTERS;
      const nightShare = nightShareOf(hoursOf.get(profile.memberId) ?? []);
      const tags = computeTags({ totals: memberTotals, profile, now });

      if (!this.matches(criteria, { profile, totals: memberTotals, nightShare, tags, playerSet, contactSet, now })) {
        continue;
      }

      hits.push({
        memberId: profile.memberId,
        totals: memberTotals,
        nightShare,
        tags,
        lastActiveAt: profile.lastActiveAt,
      });
    }

    return hits.sort(sorter(criteria.sort)).slice(0, limit);
  }

  private matches(
    criteria: SearchCriteria,
    facts: {
      profile: MemberProfile;
      totals: Counters;
      nightShare: number;
      tags: readonly { id: string }[];
      playerSet: Set<string> | null;
      contactSet: Set<string> | null;
      now: Date;
    },
  ): boolean {
    const { profile, totals, nightShare, tags, playerSet, contactSet, now } = facts;

    if (criteria.minMessages !== undefined && totals.messages < criteria.minMessages) return false;
    if (criteria.minVoiceHours !== undefined && totals.voiceSeconds < criteria.minVoiceHours * 3_600) return false;
    if (criteria.nightOwl && (totals.messages < NIGHT_OWL_MIN_MESSAGES || nightShare < NIGHT_OWL_SHARE)) return false;

    if (criteria.joinedWithinDays !== undefined) {
      const joined = profile.joinedAt ?? profile.firstSeenAt;

      if (now.getTime() - joined.getTime() > criteria.joinedWithinDays * DAY_MS) return false;
    }

    if (criteria.inactiveDays !== undefined) {
      if (now.getTime() - inactivityReference(profile).getTime() < criteria.inactiveDays * DAY_MS) return false;
    }

    if (playerSet && !playerSet.has(profile.memberId)) return false;
    if (contactSet && (!contactSet.has(profile.memberId) || profile.memberId === criteria.talksTo)) return false;
    if (criteria.tag && !tags.some((tag) => tag.id === criteria.tag)) return false;

    return true;
  }

  /** Une arrivée dont le compte Discord est très récent : renvoie l'alerte si elle est nouvelle. */
  async checkNewcomer(guildId: string, memberId: string, accountCreatedAt: Date): Promise<Alert | null> {
    const now = this.clock();
    const alert = suspiciousAccount(memberId, accountCreatedAt, now);

    return alert && (await this.store.claimAlert(guildId, alertKey(alert), now)) ? alert : null;
  }

  /** Évalue les règles périodiques et renvoie les alertes nouvelles (jamais deux fois la même). */
  async evaluateAlerts(guildId: string): Promise<readonly Alert[]> {
    await this.settle();

    const now = this.clock();
    const alerts: Alert[] = [];
    const claim = async (alert: Alert | null, profile?: MemberProfile | null) => {
      if (alert && (await this.store.claimAlert(guildId, alertKey(alert, profile), now))) {
        alerts.push(alert);
      }
    };

    // 1. Beaucoup de changements d'identité en 24 h.
    for (const { memberId, count } of await this.store.identityChangeCounts(
      guildId,
      new Date(now.getTime() - DAY_MS),
    )) {
      await claim(identityChurn(memberId, count, now));
    }

    // 2. Membres réguliers qui disparaissent : on regarde les plus actifs de la fenêtre.
    const regulars = new Set<string>();

    for (const counter of ["messages", "voiceSeconds"] as const) {
      for (const row of await this.activity.leaderboard(guildId, counter, DOSSIER_WINDOW_DAYS, ALERT_CANDIDATES)) {
        regulars.add(row.memberId);
      }
    }

    for (const memberId of regulars) {
      const [profile, window] = await Promise.all([
        this.members.find(guildId, memberId),
        this.activity.totalsForMember(guildId, memberId, DOSSIER_WINDOW_DAYS),
      ]);

      if (profile) {
        await claim(goneQuiet(profile, window, now), profile);
      }
    }

    // 3. Pics d'activité aujourd'hui.
    for (const row of await this.activity.leaderboard(guildId, "messages", 1, ALERT_CANDIDATES)) {
      if (row.value < 1) continue;

      const window = await this.activity.totalsForMember(guildId, row.memberId, DOSSIER_WINDOW_DAYS);
      await claim(activitySpike(row.memberId, row.value, window, DOSSIER_WINDOW_DAYS, now));
    }

    return alerts;
  }

  /** Efface tout ce que Phaéthon sait d'un membre, en attente comme enregistré. */
  async forget(guildId: string, memberId: string): Promise<void> {
    this.tracker.forget(guildId, memberId);
    await this.store.deleteMember(guildId, memberId);
  }

  /** Efface les données des membres partis depuis assez longtemps ; à appeler avant la purge des fiches. */
  async purgeDeparted(): Promise<number> {
    const due = await this.members.departedDue();

    for (const { guildId, memberId } of due) {
      await this.forget(guildId, memberId);
      await this.activity.forget(guildId, memberId);
    }

    return due.length;
  }

  async purgeExpired(now = this.clock()): Promise<number> {
    const cutoff = retentionCutoff(now);

    return this.store.purgeBefore(dayOf(cutoff), cutoff);
  }
}

function sorter(sort: SearchCriteria["sort"]): (a: SearchHit, b: SearchHit) => number {
  const key = (hit: SearchHit): number => {
    switch (sort) {
      case "voice":
        return hit.totals.voiceSeconds;
      case "social":
        return hit.totals.reactionsGiven + hit.totals.replies + hit.totals.mentions;
      case "recent":
        return hit.lastActiveAt?.getTime() ?? 0;
      default:
        return hit.totals.messages;
    }
  };

  return (a, b) => key(b) - key(a) || a.memberId.localeCompare(b.memberId);
}

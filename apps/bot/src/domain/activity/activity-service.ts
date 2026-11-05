import { logger } from "@/shared/logger.ts";
import type { MemberStore } from "@/domain/members/member-store.ts";
import type { ActivityStore } from "./activity-store.ts";
import { dayOf, type ActivityTracker } from "./activity-tracker.ts";
import {
  isEmptyBatch,
  type ChannelMetric,
  type ChannelTotal,
  type GuildTotals,
  type LeaderboardRow,
  type MemberTotals,
  type MonthlySummary,
} from "./activity-types.ts";
import { sumCounters, type CounterName, type Counters } from "./counters.ts";

/** Durée de conservation des données d'activité et d'audit (politique validée). */
export const RETENTION_DAYS = 30;

const DAY_MS = 86_400_000;

/** Premier jour conservé : les jours strictement antérieurs sont purgés. */
export function retentionCutoff(now: Date, retentionDays = RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

/** Premier jour (inclus) d'une fenêtre de `days` jours finissant aujourd'hui, en UTC. */
export function windowStart(now: Date, days: number): string {
  const bounded = Math.min(Math.max(Math.floor(days), 1), RETENTION_DAYS);

  return dayOf(new Date(now.getTime() - (bounded - 1) * DAY_MS));
}

/** Écrit le tampon dans les stores, répond aux questions d'analyse, purge selon la rétention. */
export class ActivityService {
  constructor(
    private readonly tracker: ActivityTracker,
    private readonly store: ActivityStore,
    private readonly members: MemberStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Renvoie `true` si tout a été écrit ; sinon le lot est remis en tampon. */
  async flush(): Promise<boolean> {
    const batch = this.tracker.drain();

    if (isEmptyBatch(batch)) {
      return true;
    }

    try {
      // `touch` est idempotent (il ne recule jamais une date) : on l'écrit avant
      // les compteurs, qui sont additifs, pour qu'un nouvel essai ne les double pas.
      await this.members.touch(batch.presences);
      await this.store.add(batch);
      return true;
    } catch (error) {
      this.tracker.restore(batch);
      logger.error("Failed to flush activity", {
        daily: batch.daily.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /** Totaux d'un membre sur les `days` derniers jours (30 par défaut, le maximum conservé). */
  async totalsForMember(
    guildId: string,
    memberId: string,
    days = RETENTION_DAYS,
  ): Promise<Counters> {
    await this.flush();
    const since = windowStart(this.clock(), days);
    const stored = await this.store.listForMember(guildId, memberId);
    const pending = this.tracker.pendingForMember(guildId, memberId);

    return sumCounters(
      [...stored, ...pending].filter((snapshot) => snapshot.day >= since),
    );
  }

  async leaderboard(
    guildId: string,
    counter: CounterName,
    days: number,
    limit: number,
  ): Promise<readonly LeaderboardRow[]> {
    await this.flush();

    return this.store.leaderboard(guildId, counter, windowStart(this.clock(), days), limit);
  }

  async serverTotals(guildId: string, days: number): Promise<GuildTotals> {
    await this.flush();

    return this.store.guildTotals(guildId, windowStart(this.clock(), days));
  }

  async topChannels(
    guildId: string,
    metric: ChannelMetric,
    days: number,
    limit: number,
  ): Promise<readonly ChannelTotal[]> {
    await this.flush();

    return this.store.topChannels(guildId, metric, windowStart(this.clock(), days), limit);
  }

  /** Totaux de chaque membre actif sur les `days` derniers jours. */
  async totalsByMember(guildId: string, days: number): Promise<readonly MemberTotals[]> {
    await this.flush();

    return this.store.totalsByMember(guildId, windowStart(this.clock(), days));
  }

  async channelsForMember(
    guildId: string,
    memberId: string,
    metric: ChannelMetric,
    days: number,
    limit: number,
  ): Promise<readonly ChannelTotal[]> {
    await this.flush();

    return this.store.channelsForMember(guildId, memberId, metric, windowStart(this.clock(), days), limit);
  }

  /** Résumés mensuels d'un membre, du plus récent au plus ancien. */
  monthlyForMember(guildId: string, memberId: string, limit: number): Promise<readonly MonthlySummary[]> {
    return this.store.monthlyForMember(guildId, memberId, limit);
  }

  async hourlyMessages(guildId: string, days: number): Promise<readonly number[]> {
    await this.flush();

    return this.store.hourlyMessages(guildId, windowStart(this.clock(), days));
  }

  /** Efface les données individuelles d'un membre, en attente comme enregistrées. */
  async forget(guildId: string, memberId: string): Promise<void> {
    this.tracker.forget(guildId, memberId);
    await this.store.deleteMember(guildId, memberId);
  }

  async purgeExpired(now = this.clock()): Promise<number> {
    return this.store.purgeBefore(dayOf(retentionCutoff(now)));
  }
}

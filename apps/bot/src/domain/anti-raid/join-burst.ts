import { joinWeight, RAID_CALM_MS, type AntiRaidSettings } from "./anti-raid-rules.ts";

type Join = Readonly<{ memberId: string; at: number; weight: 1 | 2 }>;

type ActiveRaid = {
  readonly raidId: string;
  readonly startedAt: number;
  /** Déclaré à la main (`/server lockdown`, panneau) : ne prend jamais fin tout seul. */
  readonly manual: boolean;
  lastJoinAt: number;
  joins: number;
};

/** Ce que l'arrivée d'un membre change. */
export type JoinVerdict =
  /** Rien d'anormal. */
  | Readonly<{ kind: "calm"; weighted: number }>
  /** La rafale franchit le seuil : un raid commence, et ces comptes (arrivés dans la fenêtre) en font partie. */
  | Readonly<{ kind: "started"; weighted: number; memberIds: readonly string[] }>
  /** Un raid est en cours : ce compte en fait partie. */
  | Readonly<{ kind: "raider"; raidId: string }>;

/** Un raid qui vient de prendre fin faute de nouvelles arrivées. */
export type CalmedRaid = Readonly<{ guildId: string; raidId: string; joins: number }>;

/**
 * Détection des rafales d'arrivées, serveur par serveur, sur une fenêtre glissante. Pur et en mémoire : la base garde
 * les raids déclarés (pour l'historique et la restauration après un redémarrage), pas chaque arrivée.
 */
export class JoinBurstDetector {
  private readonly joins = new Map<string, Join[]>();
  private readonly raids = new Map<string, ActiveRaid>();

  /** Enregistre une arrivée et dit si elle déclenche un raid ou en fait partie. */
  record(guildId: string, memberId: string, at: Date, settings: AntiRaidSettings): JoinVerdict {
    const now = at.getTime();
    const raid = this.raids.get(guildId);

    if (raid) {
      raid.lastJoinAt = Math.max(raid.lastJoinAt, now);
      raid.joins += 1;
      return { kind: "raider", raidId: raid.raidId };
    }

    const windowStart = now - settings.windowSeconds * 1_000;
    const recent = (this.joins.get(guildId) ?? []).filter((join) => join.at > windowStart && join.memberId !== memberId);
    recent.push({ memberId, at: now, weight: joinWeight(memberId, at, settings.minAccountAgeDays) });
    this.joins.set(guildId, recent);

    const weighted = recent.reduce((sum, join) => sum + join.weight, 0);

    if (!settings.enabled || weighted < settings.joinThreshold) {
      return { kind: "calm", weighted };
    }

    return { kind: "started", weighted, memberIds: recent.map((join) => join.memberId) };
  }

  /** Le raid est enregistré en base : les arrivées suivantes en font partie. */
  begin(guildId: string, raidId: string, startedAt: Date, manual: boolean, joins = 0, lastJoinAt = startedAt): void {
    this.raids.set(guildId, { raidId, startedAt: startedAt.getTime(), manual, lastJoinAt: lastJoinAt.getTime(), joins });
    this.joins.delete(guildId);
  }

  active(guildId: string): Readonly<{ raidId: string; startedAt: Date; manual: boolean; joins: number }> | null {
    const raid = this.raids.get(guildId);

    return raid ? { raidId: raid.raidId, startedAt: new Date(raid.startedAt), manual: raid.manual, joins: raid.joins } : null;
  }

  end(guildId: string): void {
    this.raids.delete(guildId);
  }

  /** Raids déclarés par la rafale restés sans arrivée depuis {@link RAID_CALM_MS} ; ils sont retirés. Oublie aussi les vieilles arrivées. */
  sweep(now: Date, maxWindowMs = 120_000): CalmedRaid[] {
    const calmed: CalmedRaid[] = [];

    for (const [guildId, raid] of this.raids) {
      if (!raid.manual && now.getTime() - raid.lastJoinAt >= RAID_CALM_MS) {
        calmed.push({ guildId, raidId: raid.raidId, joins: raid.joins });
        this.raids.delete(guildId);
      }
    }

    for (const [guildId, joins] of this.joins) {
      const kept = joins.filter((join) => join.at > now.getTime() - maxWindowMs);

      if (kept.length === 0) {
        this.joins.delete(guildId);
      } else {
        this.joins.set(guildId, kept);
      }
    }

    return calmed;
  }
}

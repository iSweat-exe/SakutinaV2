import type { PhaethonStore } from "@/domain/phaethon/phaethon-store.ts";
import {
  EDGE_METRICS,
  PRESENCE_STATUSES,
  type EdgeSnapshot,
  type GameSnapshot,
  type GameTotal,
  type IdentityChangeCount,
  type IdentityEvent,
  type MemberHourRow,
  type MemberHourSnapshot,
  type PhaethonBatch,
  type PresenceTotals,
  type StatusSnapshot,
} from "@/domain/phaethon/phaethon-types.ts";

const NAME_KINDS = new Set(["nickname", "username", "display-name", "avatar"]);

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryPhaethonStore implements PhaethonStore {
  private readonly edges = new Map<string, EdgeSnapshot>();
  private readonly hours = new Map<string, MemberHourSnapshot>();
  private readonly statuses = new Map<string, StatusSnapshot>();
  private readonly games = new Map<string, GameSnapshot>();
  private readonly identity = new Map<string, IdentityEvent>();
  private readonly alerts = new Map<string, Date>();

  async add(batch: PhaethonBatch): Promise<void> {
    for (const delta of batch.edges) {
      const key = `${delta.guildId}:${delta.memberId}:${delta.targetId}:${delta.day}`;
      const current = this.edges.get(key);
      this.edges.set(
        key,
        current
          ? ({
              ...current,
              ...Object.fromEntries(EDGE_METRICS.map((metric) => [metric, current[metric] + delta[metric]])),
            } as EdgeSnapshot)
          : delta,
      );
    }

    for (const delta of batch.hours) {
      const key = `${delta.guildId}:${delta.memberId}:${delta.day}:${delta.hour}`;
      const current = this.hours.get(key);
      this.hours.set(key, current ? { ...current, messages: current.messages + delta.messages } : delta);
    }

    for (const delta of batch.statuses) {
      const key = `${delta.guildId}:${delta.memberId}:${delta.day}:${delta.status}`;
      const current = this.statuses.get(key);
      this.statuses.set(key, current ? { ...current, seconds: current.seconds + delta.seconds } : delta);
    }

    for (const delta of batch.games) {
      const key = `${delta.guildId}:${delta.memberId}:${delta.day}:${delta.kind}:${delta.name}`;
      const current = this.games.get(key);
      this.games.set(key, current ? { ...current, seconds: current.seconds + delta.seconds } : delta);
    }

    for (const event of batch.identity) {
      if (!this.identity.has(event.id)) {
        this.identity.set(event.id, event);
      }
    }
  }

  async edgesForMember(guildId: string, memberId: string, sinceDay: string): Promise<readonly EdgeSnapshot[]> {
    return [...this.edges.values()].filter(
      (edge) =>
        edge.guildId === guildId &&
        edge.day >= sinceDay &&
        (edge.memberId === memberId || edge.targetId === memberId),
    );
  }

  async edgesBetween(
    guildId: string,
    leftId: string,
    rightId: string,
    sinceDay: string,
  ): Promise<readonly EdgeSnapshot[]> {
    return [...this.edges.values()].filter(
      (edge) =>
        edge.guildId === guildId &&
        edge.day >= sinceDay &&
        ((edge.memberId === leftId && edge.targetId === rightId) ||
          (edge.memberId === rightId && edge.targetId === leftId)),
    );
  }

  async contactIds(guildId: string, memberId: string, sinceDay: string): Promise<readonly string[]> {
    const ids = new Set<string>();

    for (const edge of await this.edgesForMember(guildId, memberId, sinceDay)) {
      ids.add(edge.memberId === memberId ? edge.targetId : edge.memberId);
    }

    return [...ids];
  }

  async hoursForMember(guildId: string, memberId: string, sinceDay: string): Promise<readonly number[]> {
    const hours = Array.from({ length: 24 }, () => 0);

    for (const row of this.hours.values()) {
      if (row.guildId === guildId && row.memberId === memberId && row.day >= sinceDay) {
        hours[row.hour] = (hours[row.hour] ?? 0) + row.messages;
      }
    }

    return hours;
  }

  async hoursByMember(guildId: string, sinceDay: string): Promise<readonly MemberHourRow[]> {
    const rows = new Map<string, MemberHourRow>();

    for (const row of this.hours.values()) {
      if (row.guildId === guildId && row.day >= sinceDay) {
        const key = `${row.memberId}:${row.hour}`;
        const current = rows.get(key);
        rows.set(key, {
          memberId: row.memberId,
          hour: row.hour,
          messages: (current?.messages ?? 0) + row.messages,
        });
      }
    }

    return [...rows.values()];
  }

  async presenceForMember(guildId: string, memberId: string, sinceDay: string): Promise<PresenceTotals> {
    const totals = Object.fromEntries(PRESENCE_STATUSES.map((status) => [status, 0])) as {
      -readonly [K in keyof PresenceTotals]: number;
    };

    for (const row of this.statuses.values()) {
      if (row.guildId === guildId && row.memberId === memberId && row.day >= sinceDay) {
        totals[row.status] += row.seconds;
      }
    }

    return totals;
  }

  async gamesForMember(
    guildId: string,
    memberId: string,
    sinceDay: string,
    limit: number,
  ): Promise<readonly GameTotal[]> {
    const totals = new Map<string, GameTotal>();

    for (const row of this.games.values()) {
      if (row.guildId === guildId && row.memberId === memberId && row.day >= sinceDay) {
        const key = `${row.kind}:${row.name}`;
        const current = totals.get(key);
        totals.set(key, {
          name: row.name,
          kind: row.kind,
          seconds: (current?.seconds ?? 0) + row.seconds,
        });
      }
    }

    return [...totals.values()]
      .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  async membersPlaying(guildId: string, sinceDay: string, query: string): Promise<readonly string[]> {
    const needle = query.toLowerCase();
    const ids = new Set<string>();

    for (const row of this.games.values()) {
      if (row.guildId === guildId && row.day >= sinceDay && row.name.toLowerCase().includes(needle)) {
        ids.add(row.memberId);
      }
    }

    return [...ids];
  }

  async identityHistory(guildId: string, memberId: string, limit: number): Promise<readonly IdentityEvent[]> {
    return [...this.identity.values()]
      .filter((event) => event.guildId === guildId && event.memberId === memberId)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }

  async identityChangeCounts(guildId: string, since: Date): Promise<readonly IdentityChangeCount[]> {
    const counts = new Map<string, number>();

    for (const event of this.identity.values()) {
      if (event.guildId === guildId && event.at.getTime() >= since.getTime() && NAME_KINDS.has(event.kind)) {
        counts.set(event.memberId, (counts.get(event.memberId) ?? 0) + 1);
      }
    }

    return [...counts].map(([memberId, count]) => ({ memberId, count }));
  }

  async claimAlert(guildId: string, key: string, at: Date): Promise<boolean> {
    const full = `${guildId}:${key}`;

    if (this.alerts.has(full)) {
      return false;
    }

    this.alerts.set(full, at);

    return true;
  }

  async deleteMember(guildId: string, memberId: string): Promise<void> {
    for (const [key, edge] of this.edges) {
      if (edge.guildId === guildId && (edge.memberId === memberId || edge.targetId === memberId)) {
        this.edges.delete(key);
      }
    }

    for (const map of [this.hours, this.statuses, this.games, this.identity] as Map<
      string,
      { guildId: string; memberId: string }
    >[]) {
      for (const [key, row] of map) {
        if (row.guildId === guildId && row.memberId === memberId) {
          map.delete(key);
        }
      }
    }

    // Clés d'alerte : `genre:membre[:jour]`.
    for (const key of this.alerts.keys()) {
      const [alertGuild, , alertMember] = key.split(":");

      if (alertGuild === guildId && alertMember === memberId) {
        this.alerts.delete(key);
      }
    }
  }

  async purgeBefore(day: string, cutoff: Date): Promise<number> {
    let removed = 0;

    for (const map of [this.edges, this.hours, this.statuses, this.games] as Map<string, { day: string }>[]) {
      for (const [key, row] of map) {
        if (row.day < day) {
          map.delete(key);
          removed += 1;
        }
      }
    }

    for (const [key, event] of this.identity) {
      if (event.at.getTime() < cutoff.getTime()) {
        this.identity.delete(key);
        removed += 1;
      }
    }

    for (const [key, createdAt] of this.alerts) {
      if (createdAt.getTime() < cutoff.getTime()) {
        this.alerts.delete(key);
        removed += 1;
      }
    }

    return removed;
  }
}

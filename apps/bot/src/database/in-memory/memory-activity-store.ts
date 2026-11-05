import type { ActivityStore } from "@/domain/activity/activity-store.ts";
import type {
  ActivityBatch,
  ActivitySnapshot,
  ChannelMetric,
  ChannelSnapshot,
  ChannelTotal,
  GuildTotals,
  HourlySnapshot,
  LeaderboardRow,
  MemberTotals,
  MonthlySummary,
} from "@/domain/activity/activity-types.ts";
import {
  EMPTY_COUNTERS,
  addCounters,
  sumCounters,
  type CounterName,
} from "@/domain/activity/counters.ts";

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryActivityStore implements ActivityStore {
  private readonly daily = new Map<string, ActivitySnapshot>();
  private readonly channels = new Map<string, ChannelSnapshot>();
  private readonly hourly = new Map<string, HourlySnapshot>();
  private readonly monthly = new Map<string, MonthlySummary & { guildId: string; memberId: string }>();

  async add(batch: Omit<ActivityBatch, "presences">): Promise<void> {
    for (const delta of batch.daily) {
      const key = `${delta.guildId}:${delta.memberId}:${delta.day}`;
      const current = this.daily.get(key);
      this.daily.set(key, current ? { ...current, ...addCounters(current, delta) } : delta);
    }

    for (const delta of batch.channels) {
      const key = `${delta.guildId}:${delta.memberId}:${delta.channelId}:${delta.day}`;
      const current = this.channels.get(key);
      this.channels.set(
        key,
        current
          ? {
              ...current,
              messages: current.messages + delta.messages,
              voiceSeconds: current.voiceSeconds + delta.voiceSeconds,
            }
          : delta,
      );
    }

    for (const delta of batch.hourly) {
      const key = `${delta.guildId}:${delta.day}:${delta.hour}`;
      const current = this.hourly.get(key);
      this.hourly.set(
        key,
        current
          ? {
              ...current,
              messages: current.messages + delta.messages,
              voiceSeconds: current.voiceSeconds + delta.voiceSeconds,
            }
          : delta,
      );
    }
  }

  async listForMember(
    guildId: string,
    memberId: string,
  ): Promise<readonly ActivitySnapshot[]> {
    return [...this.daily.values()].filter(
      (row) => row.guildId === guildId && row.memberId === memberId,
    );
  }

  async leaderboard(
    guildId: string,
    counter: CounterName,
    sinceDay: string,
    limit: number,
  ): Promise<readonly LeaderboardRow[]> {
    const byMember = new Map<string, number>();

    for (const row of this.daily.values()) {
      if (row.guildId === guildId && row.day >= sinceDay) {
        byMember.set(row.memberId, (byMember.get(row.memberId) ?? 0) + row[counter]);
      }
    }

    return [...byMember]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([memberId, value]) => ({ memberId, value }));
  }

  async guildTotals(guildId: string, sinceDay: string): Promise<GuildTotals> {
    const rows = [...this.daily.values()].filter(
      (row) => row.guildId === guildId && row.day >= sinceDay,
    );
    const active = new Set(
      rows.filter((row) => row.messages > 0 || row.voiceSeconds > 0).map((row) => row.memberId),
    );

    return {
      totals: rows.length ? sumCounters(rows) : EMPTY_COUNTERS,
      activeMembers: active.size,
    };
  }

  async topChannels(
    guildId: string,
    metric: ChannelMetric,
    sinceDay: string,
    limit: number,
  ): Promise<readonly ChannelTotal[]> {
    const byChannel = new Map<string, number>();

    for (const row of this.channels.values()) {
      if (row.guildId === guildId && row.day >= sinceDay) {
        byChannel.set(row.channelId, (byChannel.get(row.channelId) ?? 0) + row[metric]);
      }
    }

    return [...byChannel]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([channelId, value]) => ({ channelId, value }));
  }

  async totalsByMember(guildId: string, sinceDay: string): Promise<readonly MemberTotals[]> {
    const byMember = new Map<string, ActivitySnapshot[]>();

    for (const row of this.daily.values()) {
      if (row.guildId === guildId && row.day >= sinceDay) {
        byMember.set(row.memberId, [...(byMember.get(row.memberId) ?? []), row]);
      }
    }

    return [...byMember].map(([memberId, rows]) => ({ memberId, ...sumCounters(rows) }));
  }

  async channelsForMember(
    guildId: string,
    memberId: string,
    metric: ChannelMetric,
    sinceDay: string,
    limit: number,
  ): Promise<readonly ChannelTotal[]> {
    const byChannel = new Map<string, number>();

    for (const row of this.channels.values()) {
      if (row.guildId === guildId && row.memberId === memberId && row.day >= sinceDay) {
        byChannel.set(row.channelId, (byChannel.get(row.channelId) ?? 0) + row[metric]);
      }
    }

    return [...byChannel]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([channelId, value]) => ({ channelId, value }));
  }

  async monthlyForMember(
    guildId: string,
    memberId: string,
    limit: number,
  ): Promise<readonly MonthlySummary[]> {
    return [...this.monthly.values()]
      .filter((row) => row.guildId === guildId && row.memberId === memberId)
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, limit);
  }

  async hourlyMessages(guildId: string, sinceDay: string): Promise<readonly number[]> {
    const hours = Array.from({ length: 24 }, () => 0);

    for (const row of this.hourly.values()) {
      if (row.guildId === guildId && row.day >= sinceDay) {
        hours[row.hour] = (hours[row.hour] ?? 0) + row.messages;
      }
    }

    return hours;
  }

  async deleteMember(guildId: string, memberId: string): Promise<void> {
    for (const [key, row] of this.daily) {
      if (row.guildId === guildId && row.memberId === memberId) this.daily.delete(key);
    }

    for (const [key, row] of this.channels) {
      if (row.guildId === guildId && row.memberId === memberId) this.channels.delete(key);
    }

    for (const [key, row] of this.monthly) {
      if (row.guildId === guildId && row.memberId === memberId) this.monthly.delete(key);
    }
  }

  async purgeBefore(day: string): Promise<number> {
    let removed = 0;

    // Le détail quotidien disparaît, son résumé mensuel reste.
    for (const row of this.daily.values()) {
      if (row.day < day) {
        const month = row.day.slice(0, 7);
        const key = `${row.guildId}:${row.memberId}:${month}`;
        const current = this.monthly.get(key);
        const active = row.messages > 0 || row.voiceSeconds > 0 ? 1 : 0;

        this.monthly.set(
          key,
          current
            ? { ...current, ...addCounters(current, row), activeDays: current.activeDays + active }
            : {
                guildId: row.guildId,
                memberId: row.memberId,
                month,
                activeDays: active,
                ...addCounters(EMPTY_COUNTERS, row),
              },
        );
      }
    }

    for (const map of [this.daily, this.channels, this.hourly] as Map<string, { day: string }>[]) {
      for (const [key, row] of map) {
        if (row.day < day) {
          map.delete(key);
          removed += 1;
        }
      }
    }

    return removed;
  }
}

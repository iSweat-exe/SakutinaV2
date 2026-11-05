import { and, asc, desc, eq, getTableColumns, gte, lt, sql } from "drizzle-orm";

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
} from "@/domain/activity/activity-types.ts";
import {
  COUNTER_NAMES,
  addCounters,
  type CounterName,
  type Counters,
} from "@/domain/activity/counters.ts";
import type { Database } from "../connection.ts";
import { activityChannelDaily, activityDaily, activityHourly } from "../schema/index.ts";

const BATCH_SIZE = 500;
const columns = getTableColumns(activityDaily);

export class PostgresActivityStore implements ActivityStore {
  constructor(private readonly db: Database) {}

  async add(batch: Omit<ActivityBatch, "presences">): Promise<void> {
    const additive = Object.fromEntries(
      COUNTER_NAMES.map((name) => [
        name,
        sql`${columns[name]} + excluded.${sql.raw(columns[name].name)}`,
      ]),
    );

    for (const rows of chunks(mergeDaily(batch.daily))) {
      await this.db
        .insert(activityDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [activityDaily.guildId, activityDaily.memberId, activityDaily.day],
          set: additive,
        });
    }

    for (const rows of chunks(mergeChannels(batch.channels))) {
      await this.db
        .insert(activityChannelDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            activityChannelDaily.guildId,
            activityChannelDaily.memberId,
            activityChannelDaily.channelId,
            activityChannelDaily.day,
          ],
          set: {
            messages: sql`${activityChannelDaily.messages} + excluded.messages`,
            voiceSeconds: sql`${activityChannelDaily.voiceSeconds} + excluded.voice_seconds`,
          },
        });
    }

    for (const rows of chunks(mergeHourly(batch.hourly))) {
      await this.db
        .insert(activityHourly)
        .values(rows)
        .onConflictDoUpdate({
          target: [activityHourly.guildId, activityHourly.day, activityHourly.hour],
          set: { messages: sql`${activityHourly.messages} + excluded.messages` },
        });
    }
  }

  async listForMember(
    guildId: string,
    memberId: string,
  ): Promise<readonly ActivitySnapshot[]> {
    return this.db
      .select()
      .from(activityDaily)
      .where(and(eq(activityDaily.guildId, guildId), eq(activityDaily.memberId, memberId)));
  }

  async leaderboard(
    guildId: string,
    counter: CounterName,
    sinceDay: string,
    limit: number,
  ): Promise<readonly LeaderboardRow[]> {
    const total = sql<number>`sum(${columns[counter]})`;

    return this.db
      .select({ memberId: activityDaily.memberId, value: total.mapWith(Number) })
      .from(activityDaily)
      .where(and(eq(activityDaily.guildId, guildId), gte(activityDaily.day, sinceDay)))
      .groupBy(activityDaily.memberId)
      .having(sql`sum(${columns[counter]}) > 0`)
      .orderBy(desc(total), asc(activityDaily.memberId))
      .limit(limit);
  }

  async guildTotals(guildId: string, sinceDay: string): Promise<GuildTotals> {
    const sums = Object.fromEntries(
      COUNTER_NAMES.map((name) => [
        name,
        sql<number>`coalesce(sum(${columns[name]}), 0)`.mapWith(Number),
      ]),
    );

    const [row] = await this.db
      .select({
        ...sums,
        activeMembers: sql<number>`count(distinct ${activityDaily.memberId}) filter (where ${activityDaily.messages} > 0 or ${activityDaily.voiceSeconds} > 0)`.mapWith(
          Number,
        ),
      })
      .from(activityDaily)
      .where(and(eq(activityDaily.guildId, guildId), gte(activityDaily.day, sinceDay)));

    const { activeMembers, ...totals } = (row ?? { activeMembers: 0 }) as Record<string, number>;

    return {
      totals: Object.fromEntries(
        COUNTER_NAMES.map((name) => [name, totals[name] ?? 0]),
      ) as Counters,
      activeMembers: activeMembers ?? 0,
    };
  }

  async topChannels(
    guildId: string,
    metric: ChannelMetric,
    sinceDay: string,
    limit: number,
  ): Promise<readonly ChannelTotal[]> {
    const column = metric === "messages" ? activityChannelDaily.messages : activityChannelDaily.voiceSeconds;
    const total = sql<number>`sum(${column})`;

    return this.db
      .select({ channelId: activityChannelDaily.channelId, value: total.mapWith(Number) })
      .from(activityChannelDaily)
      .where(
        and(eq(activityChannelDaily.guildId, guildId), gte(activityChannelDaily.day, sinceDay)),
      )
      .groupBy(activityChannelDaily.channelId)
      .having(sql`sum(${column}) > 0`)
      .orderBy(desc(total), asc(activityChannelDaily.channelId))
      .limit(limit);
  }

  async hourlyMessages(guildId: string, sinceDay: string): Promise<readonly number[]> {
    const rows = await this.db
      .select({
        hour: activityHourly.hour,
        value: sql<number>`sum(${activityHourly.messages})`.mapWith(Number),
      })
      .from(activityHourly)
      .where(and(eq(activityHourly.guildId, guildId), gte(activityHourly.day, sinceDay)))
      .groupBy(activityHourly.hour);

    const hours = Array.from({ length: 24 }, () => 0);

    for (const { hour, value } of rows) {
      hours[hour] = value;
    }

    return hours;
  }

  async deleteMember(guildId: string, memberId: string): Promise<void> {
    await this.db
      .delete(activityDaily)
      .where(and(eq(activityDaily.guildId, guildId), eq(activityDaily.memberId, memberId)));
    await this.db
      .delete(activityChannelDaily)
      .where(
        and(
          eq(activityChannelDaily.guildId, guildId),
          eq(activityChannelDaily.memberId, memberId),
        ),
      );
  }

  async purgeBefore(day: string): Promise<number> {
    const daily = await this.db
      .delete(activityDaily)
      .where(lt(activityDaily.day, day))
      .returning({ day: activityDaily.day });
    const channels = await this.db
      .delete(activityChannelDaily)
      .where(lt(activityChannelDaily.day, day))
      .returning({ day: activityChannelDaily.day });
    const hourly = await this.db
      .delete(activityHourly)
      .where(lt(activityHourly.day, day))
      .returning({ day: activityHourly.day });

    return daily.length + channels.length + hourly.length;
  }
}

function* chunks<T>(rows: readonly T[]): Generator<T[]> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    yield rows.slice(start, start + BATCH_SIZE);
  }
}

/** Un `INSERT ... ON CONFLICT` ne tolère pas deux fois la même clé dans un lot. */
function mergeDaily(rows: readonly ActivitySnapshot[]): ActivitySnapshot[] {
  const merged = new Map<string, ActivitySnapshot>();

  for (const row of rows) {
    const key = `${row.guildId}:${row.memberId}:${row.day}`;
    const current = merged.get(key);
    merged.set(key, current ? { ...current, ...addCounters(current, row) } : row);
  }

  return [...merged.values()];
}

function mergeChannels(rows: readonly ChannelSnapshot[]): ChannelSnapshot[] {
  const merged = new Map<string, ChannelSnapshot>();

  for (const row of rows) {
    const key = `${row.guildId}:${row.memberId}:${row.channelId}:${row.day}`;
    const current = merged.get(key);
    merged.set(
      key,
      current
        ? {
            ...current,
            messages: current.messages + row.messages,
            voiceSeconds: current.voiceSeconds + row.voiceSeconds,
          }
        : row,
    );
  }

  return [...merged.values()];
}

function mergeHourly(rows: readonly HourlySnapshot[]): HourlySnapshot[] {
  const merged = new Map<string, HourlySnapshot>();

  for (const row of rows) {
    const key = `${row.guildId}:${row.day}:${row.hour}`;
    const current = merged.get(key);
    merged.set(
      key,
      current ? { ...current, messages: current.messages + row.messages } : row,
    );
  }

  return [...merged.values()];
}

import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

import type { PhaethonStore } from "@/domain/phaethon/phaethon-store.ts";
import {
  PRESENCE_STATUSES,
  type EdgeSnapshot,
  type GameKind,
  type GameTotal,
  type IdentityChangeCount,
  type IdentityEvent,
  type IdentityKind,
  type MemberHourRow,
  type PhaethonBatch,
  type PresenceStatus,
  type PresenceTotals,
} from "@/domain/phaethon/phaethon-types.ts";
import type { Database } from "../connection.ts";
import {
  identityEvent,
  memberHourDaily,
  phaethonAlert,
  presenceGameDaily,
  presenceStatusDaily,
  socialEdgeDaily,
} from "../schema/index.ts";

const BATCH_SIZE = 500;
const NAME_KINDS = ["nickname", "username", "display-name", "avatar"];

export class PostgresPhaethonStore implements PhaethonStore {
  constructor(private readonly db: Database) {}

  async add(batch: PhaethonBatch): Promise<void> {
    for (const rows of chunks(mergeBy(batch.edges, (r) => `${r.guildId}:${r.memberId}:${r.targetId}:${r.day}`, (a, b) => ({
      ...a,
      replies: a.replies + b.replies,
      mentions: a.mentions + b.mentions,
      reactions: a.reactions + b.reactions,
      voiceSeconds: a.voiceSeconds + b.voiceSeconds,
    })))) {
      await this.db
        .insert(socialEdgeDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [socialEdgeDaily.guildId, socialEdgeDaily.memberId, socialEdgeDaily.targetId, socialEdgeDaily.day],
          set: {
            replies: sql`${socialEdgeDaily.replies} + excluded.replies`,
            mentions: sql`${socialEdgeDaily.mentions} + excluded.mentions`,
            reactions: sql`${socialEdgeDaily.reactions} + excluded.reactions`,
            voiceSeconds: sql`${socialEdgeDaily.voiceSeconds} + excluded.voice_seconds`,
          },
        });
    }

    for (const rows of chunks(mergeBy(batch.hours, (r) => `${r.guildId}:${r.memberId}:${r.day}:${r.hour}`, (a, b) => ({
      ...a,
      messages: a.messages + b.messages,
    })))) {
      await this.db
        .insert(memberHourDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [memberHourDaily.guildId, memberHourDaily.memberId, memberHourDaily.day, memberHourDaily.hour],
          set: { messages: sql`${memberHourDaily.messages} + excluded.messages` },
        });
    }

    for (const rows of chunks(mergeBy(batch.statuses, (r) => `${r.guildId}:${r.memberId}:${r.day}:${r.status}`, (a, b) => ({
      ...a,
      seconds: a.seconds + b.seconds,
    })))) {
      await this.db
        .insert(presenceStatusDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            presenceStatusDaily.guildId,
            presenceStatusDaily.memberId,
            presenceStatusDaily.day,
            presenceStatusDaily.status,
          ],
          set: { seconds: sql`${presenceStatusDaily.seconds} + excluded.seconds` },
        });
    }

    for (const rows of chunks(mergeBy(batch.games, (r) => `${r.guildId}:${r.memberId}:${r.day}:${r.kind}:${r.name}`, (a, b) => ({
      ...a,
      seconds: a.seconds + b.seconds,
    })))) {
      await this.db
        .insert(presenceGameDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            presenceGameDaily.guildId,
            presenceGameDaily.memberId,
            presenceGameDaily.day,
            presenceGameDaily.kind,
            presenceGameDaily.name,
          ],
          set: { seconds: sql`${presenceGameDaily.seconds} + excluded.seconds` },
        });
    }

    for (const rows of chunks(batch.identity)) {
      await this.db
        .insert(identityEvent)
        .values(
          rows.map((event) => ({
            id: event.id,
            guildId: event.guildId,
            memberId: event.memberId,
            kind: event.kind,
            oldValue: event.oldValue,
            newValue: event.newValue,
            occurredAt: event.at,
          })),
        )
        .onConflictDoNothing();
    }
  }

  async edgesForMember(guildId: string, memberId: string, sinceDay: string): Promise<readonly EdgeSnapshot[]> {
    return this.db
      .select()
      .from(socialEdgeDaily)
      .where(
        and(
          eq(socialEdgeDaily.guildId, guildId),
          gte(socialEdgeDaily.day, sinceDay),
          or(eq(socialEdgeDaily.memberId, memberId), eq(socialEdgeDaily.targetId, memberId)),
        ),
      );
  }

  async edgesBetween(
    guildId: string,
    leftId: string,
    rightId: string,
    sinceDay: string,
  ): Promise<readonly EdgeSnapshot[]> {
    return this.db
      .select()
      .from(socialEdgeDaily)
      .where(
        and(
          eq(socialEdgeDaily.guildId, guildId),
          gte(socialEdgeDaily.day, sinceDay),
          or(
            and(eq(socialEdgeDaily.memberId, leftId), eq(socialEdgeDaily.targetId, rightId)),
            and(eq(socialEdgeDaily.memberId, rightId), eq(socialEdgeDaily.targetId, leftId)),
          ),
        ),
      );
  }

  async contactIds(guildId: string, memberId: string, sinceDay: string): Promise<readonly string[]> {
    const other = sql<string>`case when ${socialEdgeDaily.memberId} = ${memberId} then ${socialEdgeDaily.targetId} else ${socialEdgeDaily.memberId} end`;
    const rows = await this.db
      .selectDistinct({ id: other })
      .from(socialEdgeDaily)
      .where(
        and(
          eq(socialEdgeDaily.guildId, guildId),
          gte(socialEdgeDaily.day, sinceDay),
          or(eq(socialEdgeDaily.memberId, memberId), eq(socialEdgeDaily.targetId, memberId)),
        ),
      );

    return rows.map((row) => row.id);
  }

  async hoursForMember(guildId: string, memberId: string, sinceDay: string): Promise<readonly number[]> {
    const rows = await this.db
      .select({ hour: memberHourDaily.hour, value: sql<number>`sum(${memberHourDaily.messages})`.mapWith(Number) })
      .from(memberHourDaily)
      .where(
        and(
          eq(memberHourDaily.guildId, guildId),
          eq(memberHourDaily.memberId, memberId),
          gte(memberHourDaily.day, sinceDay),
        ),
      )
      .groupBy(memberHourDaily.hour);
    const hours = Array.from({ length: 24 }, () => 0);

    for (const { hour, value } of rows) {
      hours[hour] = value;
    }

    return hours;
  }

  async hoursByMember(guildId: string, sinceDay: string): Promise<readonly MemberHourRow[]> {
    return this.db
      .select({
        memberId: memberHourDaily.memberId,
        hour: memberHourDaily.hour,
        messages: sql<number>`sum(${memberHourDaily.messages})`.mapWith(Number),
      })
      .from(memberHourDaily)
      .where(and(eq(memberHourDaily.guildId, guildId), gte(memberHourDaily.day, sinceDay)))
      .groupBy(memberHourDaily.memberId, memberHourDaily.hour);
  }

  async presenceForMember(guildId: string, memberId: string, sinceDay: string): Promise<PresenceTotals> {
    const rows = await this.db
      .select({
        status: presenceStatusDaily.status,
        seconds: sql<number>`sum(${presenceStatusDaily.seconds})`.mapWith(Number),
      })
      .from(presenceStatusDaily)
      .where(
        and(
          eq(presenceStatusDaily.guildId, guildId),
          eq(presenceStatusDaily.memberId, memberId),
          gte(presenceStatusDaily.day, sinceDay),
        ),
      )
      .groupBy(presenceStatusDaily.status);
    const totals = Object.fromEntries(PRESENCE_STATUSES.map((status) => [status, 0])) as Record<
      PresenceStatus,
      number
    >;

    for (const { status, seconds } of rows) {
      if (status in totals) {
        totals[status as PresenceStatus] = seconds;
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
    const total = sql<number>`sum(${presenceGameDaily.seconds})`;
    const rows = await this.db
      .select({ name: presenceGameDaily.name, kind: presenceGameDaily.kind, seconds: total.mapWith(Number) })
      .from(presenceGameDaily)
      .where(
        and(
          eq(presenceGameDaily.guildId, guildId),
          eq(presenceGameDaily.memberId, memberId),
          gte(presenceGameDaily.day, sinceDay),
        ),
      )
      .groupBy(presenceGameDaily.name, presenceGameDaily.kind)
      .orderBy(desc(total), presenceGameDaily.name)
      .limit(limit);

    return rows.map((row) => ({ ...row, kind: row.kind as GameKind }));
  }

  async membersPlaying(guildId: string, sinceDay: string, query: string): Promise<readonly string[]> {
    const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    const rows = await this.db
      .selectDistinct({ memberId: presenceGameDaily.memberId })
      .from(presenceGameDaily)
      .where(
        and(
          eq(presenceGameDaily.guildId, guildId),
          gte(presenceGameDaily.day, sinceDay),
          sql`${presenceGameDaily.name} ILIKE ${pattern}`,
        ),
      );

    return rows.map((row) => row.memberId);
  }

  async identityHistory(guildId: string, memberId: string, limit: number): Promise<readonly IdentityEvent[]> {
    const rows = await this.db
      .select()
      .from(identityEvent)
      .where(and(eq(identityEvent.guildId, guildId), eq(identityEvent.memberId, memberId)))
      .orderBy(desc(identityEvent.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      guildId: row.guildId,
      memberId: row.memberId,
      kind: row.kind as IdentityKind,
      oldValue: row.oldValue,
      newValue: row.newValue,
      at: row.occurredAt,
    }));
  }

  async identityChangeCounts(guildId: string, since: Date): Promise<readonly IdentityChangeCount[]> {
    return this.db
      .select({
        memberId: identityEvent.memberId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(identityEvent)
      .where(
        and(
          eq(identityEvent.guildId, guildId),
          gte(identityEvent.occurredAt, since),
          inArray(identityEvent.kind, NAME_KINDS),
        ),
      )
      .groupBy(identityEvent.memberId);
  }

  async claimAlert(guildId: string, key: string, at: Date): Promise<boolean> {
    const inserted = await this.db
      .insert(phaethonAlert)
      .values({ guildId, key, createdAt: at })
      .onConflictDoNothing()
      .returning({ key: phaethonAlert.key });

    return inserted.length > 0;
  }

  async deleteMember(guildId: string, memberId: string): Promise<void> {
    await this.db
      .delete(socialEdgeDaily)
      .where(
        and(
          eq(socialEdgeDaily.guildId, guildId),
          or(eq(socialEdgeDaily.memberId, memberId), eq(socialEdgeDaily.targetId, memberId)),
        ),
      );
    await this.db
      .delete(memberHourDaily)
      .where(and(eq(memberHourDaily.guildId, guildId), eq(memberHourDaily.memberId, memberId)));
    await this.db
      .delete(presenceStatusDaily)
      .where(and(eq(presenceStatusDaily.guildId, guildId), eq(presenceStatusDaily.memberId, memberId)));
    await this.db
      .delete(presenceGameDaily)
      .where(and(eq(presenceGameDaily.guildId, guildId), eq(presenceGameDaily.memberId, memberId)));
    await this.db
      .delete(identityEvent)
      .where(and(eq(identityEvent.guildId, guildId), eq(identityEvent.memberId, memberId)));
    // Clés d'alerte : `genre:membre[:jour]`.
    await this.db
      .delete(phaethonAlert)
      .where(and(eq(phaethonAlert.guildId, guildId), sql`split_part(${phaethonAlert.key}, ':', 2) = ${memberId}`));
  }

  async purgeBefore(day: string, cutoff: Date): Promise<number> {
    let removed = 0;

    for (const table of [socialEdgeDaily, memberHourDaily, presenceStatusDaily, presenceGameDaily]) {
      const rows = await this.db.delete(table).where(lt(table.day, day)).returning({ day: table.day });
      removed += rows.length;
    }

    const identity = await this.db
      .delete(identityEvent)
      .where(lt(identityEvent.occurredAt, cutoff))
      .returning({ id: identityEvent.id });
    const alerts = await this.db
      .delete(phaethonAlert)
      .where(lt(phaethonAlert.createdAt, cutoff))
      .returning({ key: phaethonAlert.key });

    return removed + identity.length + alerts.length;
  }
}

function* chunks<T>(rows: readonly T[]): Generator<T[]> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    yield rows.slice(start, start + BATCH_SIZE);
  }
}

/** Un `INSERT ... ON CONFLICT` ne tolère pas deux fois la même clé dans un lot. */
function mergeBy<T>(rows: readonly T[], keyOf: (row: T) => string, combine: (a: T, b: T) => T): T[] {
  const merged = new Map<string, T>();

  for (const row of rows) {
    const key = keyOf(row);
    const current = merged.get(key);
    merged.set(key, current ? combine(current, row) : row);
  }

  return [...merged.values()];
}

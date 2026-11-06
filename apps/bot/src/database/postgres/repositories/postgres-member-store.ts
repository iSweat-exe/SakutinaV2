import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";

import type { PresenceDelta } from "@/domain/activity/activity-types.ts";
import type { MemberIdentity, MemberProfile } from "@/domain/members/member-profile.ts";
import type { MemberStore, SeedMember } from "@/domain/members/member-store.ts";
import type { Database } from "../connection.ts";
import { memberProfile } from "../schema/index.ts";

const BATCH_SIZE = 500;
const inactivityReference = sql`coalesce(${memberProfile.lastActiveAt}, ${memberProfile.firstSeenAt})`;

export class PostgresMemberStore implements MemberStore {
  constructor(private readonly db: Database) {}

  async touch(presences: readonly PresenceDelta[]): Promise<void> {
    const latest = new Map<string, PresenceDelta>();

    for (const presence of presences) {
      const key = `${presence.guildId}:${presence.memberId}`;
      const current = latest.get(key);

      if (!current || current.at.getTime() < presence.at.getTime()) {
        latest.set(key, presence);
      }
    }

    for (const rows of chunks([...latest.values()])) {
      await this.db
        .insert(memberProfile)
        .values(
          rows.map(({ guildId, memberId, at }) => ({
            guildId,
            memberId,
            firstSeenAt: at,
            lastActiveAt: at,
          })),
        )
        .onConflictDoUpdate({
          target: [memberProfile.guildId, memberProfile.memberId],
          set: {
            lastActiveAt: sql`greatest(coalesce(${memberProfile.lastActiveAt}, excluded.last_active_at), excluded.last_active_at)`,
          },
        });
    }
  }

  async seed(guildId: string, members: readonly SeedMember[], now: Date): Promise<void> {
    for (const rows of chunks(members)) {
      await this.db
        .insert(memberProfile)
        .values(
          rows.map(({ memberId, joinedAt, identity }) => ({
            guildId,
            memberId,
            firstSeenAt: now,
            joinedAt,
            displayName: identity?.displayName ?? null,
            avatar: identity?.avatar ?? null,
            username: identity?.username ?? null,
            roleNames: identity ? [...identity.roleNames] : [],
          })),
        )
        .onConflictDoUpdate({
          target: [memberProfile.guildId, memberProfile.memberId],
          set: {
            joinedAt: sql`coalesce(${memberProfile.joinedAt}, excluded.joined_at)`,
            displayName: sql`coalesce(excluded.display_name, ${memberProfile.displayName})`,
            avatar: sql`CASE WHEN excluded.display_name IS NULL THEN ${memberProfile.avatar} ELSE excluded.avatar END`,
            username: sql`CASE WHEN excluded.display_name IS NULL THEN ${memberProfile.username} ELSE excluded.username END`,
            roleNames: sql`CASE WHEN excluded.display_name IS NULL THEN ${memberProfile.roleNames} ELSE excluded.role_names END`,
          },
        });
    }
  }

  async setIdentity(guildId: string, memberId: string, identity: MemberIdentity): Promise<void> {
    await this.db
      .update(memberProfile)
      .set({
        displayName: identity.displayName,
        avatar: identity.avatar,
        username: identity.username,
        roleNames: [...identity.roleNames],
      })
      .where(and(eq(memberProfile.guildId, guildId), eq(memberProfile.memberId, memberId)));
  }

  async markJoined(guildId: string, memberId: string, at: Date): Promise<void> {
    await this.db
      .insert(memberProfile)
      .values({ guildId, memberId, firstSeenAt: at, joinedAt: at })
      .onConflictDoUpdate({
        target: [memberProfile.guildId, memberProfile.memberId],
        set: { joinedAt: at, leftAt: null },
      });
  }

  async markLeft(guildId: string, memberId: string, at: Date): Promise<void> {
    await this.db
      .insert(memberProfile)
      .values({ guildId, memberId, firstSeenAt: at, leftAt: at })
      .onConflictDoUpdate({
        target: [memberProfile.guildId, memberProfile.memberId],
        set: { leftAt: at },
      });
  }

  async find(guildId: string, memberId: string): Promise<MemberProfile | null> {
    const [row] = await this.db
      .select()
      .from(memberProfile)
      .where(and(eq(memberProfile.guildId, guildId), eq(memberProfile.memberId, memberId)));

    return row ?? null;
  }

  async listInactive(
    guildId: string,
    before: Date,
    limit: number,
  ): Promise<readonly MemberProfile[]> {
    return this.db
      .select()
      .from(memberProfile)
      .where(
        and(
          eq(memberProfile.guildId, guildId),
          isNull(memberProfile.leftAt),
          sql`${inactivityReference} < ${before.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(asc(inactivityReference), asc(memberProfile.memberId))
      .limit(limit);
  }

  async listPresent(guildId: string): Promise<readonly MemberProfile[]> {
    return this.db
      .select()
      .from(memberProfile)
      .where(and(eq(memberProfile.guildId, guildId), isNull(memberProfile.leftAt)));
  }

  async listLeftBefore(
    before: Date,
  ): Promise<readonly { guildId: string; memberId: string }[]> {
    return this.db
      .select({ guildId: memberProfile.guildId, memberId: memberProfile.memberId })
      .from(memberProfile)
      .where(lt(memberProfile.leftAt, before));
  }

  async delete(guildId: string, memberId: string): Promise<void> {
    await this.db
      .delete(memberProfile)
      .where(and(eq(memberProfile.guildId, guildId), eq(memberProfile.memberId, memberId)));
  }

  async purgeLeftBefore(before: Date): Promise<number> {
    const removed = await this.db
      .delete(memberProfile)
      .where(lt(memberProfile.leftAt, before))
      .returning({ memberId: memberProfile.memberId });

    return removed.length;
  }
}

function* chunks<T>(rows: readonly T[]): Generator<T[]> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    yield rows.slice(start, start + BATCH_SIZE);
  }
}
